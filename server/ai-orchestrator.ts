import OpenAI from "openai";
import { GoogleGenAI } from "@google/genai";
import { storage } from "./storage";
import type { Product, StockMovement } from "@shared/schema";

// Initialize AI providers
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const gemini = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export type AIProvider = "openai" | "gemini" | "auto";

export interface ChatMessage {
    role: "user" | "assistant" | "system";
    content: string;
    timestamp: Date;
    provider?: AIProvider;
    confidence?: number;
    actions?: ChatAction[];
}

export interface ChatAction {
    type: "reorder" | "view_product" | "generate_report" | "set_alert";
    label: string;
    productId?: number;
    productName?: string;
    quantity?: number;
}

export interface NLQueryResult {
    query: string;
    intent: "search" | "analytics" | "recommendation" | "general" | "reorder" | "forecast";
    response: string;
    provider?: AIProvider;
    confidence: number;
    actions?: ChatAction[];
    toolsUsed?: string[];
    data?: any;
}

// ─────────────────────────────────────────────
// INVENTORY TOOL DEFINITIONS (Semantic Layer)
// The LLM calls these structured functions instead of generating SQL
// ─────────────────────────────────────────────

async function tool_searchProducts(query: string, filters?: { lowStock?: boolean; category?: string }): Promise<any[]> {
    const products = await storage.getProducts();
    let filtered = products.products || products;
    if (filters?.lowStock) {
          filtered = filtered.filter((p: any) => p.currentStock <= p.minStockLevel);
    }
    if (filters?.category) {
          filtered = filtered.filter((p: any) =>
                  p.category?.toLowerCase().includes(filters.category!.toLowerCase())
                                         );
    }
    if (query) {
          filtered = filtered.filter((p: any) =>
                  p.name?.toLowerCase().includes(query.toLowerCase()) ||
                  p.sku?.toLowerCase().includes(query.toLowerCase())
                                         );
    }
    return filtered.slice(0, 20);
}

async function tool_getStockTrend(productId: number, days: number = 30): Promise<any> {
    const movements = await storage.getStockMovements(productId, days * 3);
    const now = new Date();
    const cutoff = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
    const recent = movements.filter((m: any) => new Date(m.createdAt) >= cutoff);

  const inbound = recent.filter((m: any) => m.type === "in").reduce((s: number, m: any) => s + m.quantity, 0);
    const outbound = recent.filter((m: any) => m.type === "out").reduce((s: number, m: any) => s + m.quantity, 0);
    const netChange = inbound - outbound;
    const avgDailyUsage = outbound / Math.max(days, 1);

  return { productId, days, inbound, outbound, netChange, avgDailyUsage, movementCount: recent.length };
}

async function tool_calculateReorder(productId: number): Promise<any> {
    const product = await storage.getProduct(productId);
    if (!product) return { error: "Product not found" };
    const trend = await tool_getStockTrend(productId, 30);
    const leadTimeDays = 7; // assumed lead time
  const safetyStockDays = 14;
    const reorderPoint = trend.avgDailyUsage * (leadTimeDays + safetyStockDays);
    const economicOrderQty = Math.ceil(trend.avgDailyUsage * 30);
    const daysUntilStockout = trend.avgDailyUsage > 0
      ? Math.floor((product as any).currentStock / trend.avgDailyUsage)
          : 999;
    const urgency = daysUntilStockout < 7 ? "CRITICAL" : daysUntilStockout < 14 ? "HIGH" : daysUntilStockout < 30 ? "MEDIUM" : "LOW";

  return {
        productId,
        productName: (product as any).name,
        currentStock: (product as any).currentStock,
        minStockLevel: (product as any).minStockLevel,
        avgDailyUsage: trend.avgDailyUsage,
        daysUntilStockout,
        reorderPoint: Math.ceil(reorderPoint),
        recommendedOrderQty: economicOrderQty,
        urgency,
        estimatedCost: economicOrderQty * ((product as any).unitPrice || 0),
  };
}

async function tool_comparePeriods(productId: number, period1Days: number, period2Days: number): Promise<any> {
    const [trend1, trend2] = await Promise.all([
          tool_getStockTrend(productId, period1Days),
          tool_getStockTrend(productId, period2Days),
        ]);
    const growth = trend1.avgDailyUsage > 0
      ? ((trend2.avgDailyUsage - trend1.avgDailyUsage) / trend1.avgDailyUsage) * 100
          : 0;
    return { period1: trend1, period2: trend2, demandGrowthPct: Math.round(growth * 10) / 10 };
}

async function tool_getDashboardKPIs(): Promise<any> {
    const stats = await storage.getDashboardStats();
    const products = await storage.getProducts();
    const allProducts = (products as any).products || products;
    const movements = await storage.getStockMovements(undefined as any, 500);

  const totalValue = allProducts.reduce((s: number, p: any) => s + p.currentStock * (p.unitPrice || 0), 0);
    const deadStock = allProducts.filter((p: any) => p.currentStock > 0 && p.minStockLevel === 0).length;
    const stockoutRisk = allProducts.filter((p: any) => p.currentStock <= p.minStockLevel).length;
    const turnoverNumerator = movements.filter((m: any) => m.type === "out").reduce((s: number, m: any) => s + m.quantity, 0);
    const avgStock = allProducts.reduce((s: number, p: any) => s + p.currentStock, 0) / Math.max(allProducts.length, 1);
    const inventoryTurnover = avgStock > 0 ? (turnoverNumerator / avgStock) : 0;

  return {
        totalProducts: allProducts.length,
        lowStockItems: (stats as any).lowStockItems || stockoutRisk,
        outOfStockItems: (stats as any).outOfStockItems || 0,
        totalInventoryValue: totalValue,
        stockoutRiskScore: Math.min(100, Math.round((stockoutRisk / Math.max(allProducts.length, 1)) * 100)),
        inventoryTurnover: Math.round(inventoryTurnover * 10) / 10,
        deadStockCount: deadStock,
  };
}

// ─────────────────────────────────────────────
// TOOL REGISTRY for OpenAI function calling
// ─────────────────────────────────────────────
const INVENTORY_TOOLS: OpenAI.Chat.ChatCompletionTool[] = [
  {
        type: "function",
        function: {
                name: "search_products",
                description: "Search for products by name, SKU, or filter by low stock / category",
                parameters: {
                          type: "object",
                          properties: {
                                      query: { type: "string", description: "Product name or SKU to search" },
                                      lowStock: { type: "boolean", description: "Filter only low-stock products" },
                                      category: { type: "string", description: "Filter by category name" },
                          },
                          required: [],
                },
        },
  },
  {
        type: "function",
        function: {
                name: "get_stock_trend",
                description: "Get stock movement trend for a product over N days (inbound, outbound, avg daily usage)",
                parameters: {
                          type: "object",
                          properties: {
                                      productId: { type: "number", description: "The product ID" },
                                      days: { type: "number", description: "Number of days to analyse (default 30)" },
                          },
                          required: ["productId"],
                },
        },
  },
  {
        type: "function",
        function: {
                name: "calculate_reorder",
                description: "Calculate reorder recommendation for a product: EOQ, days until stockout, urgency level",
                parameters: {
                          type: "object",
                          properties: {
                                      productId: { type: "number", description: "The product ID" },
                          },
                          required: ["productId"],
                },
        },
  },
  {
        type: "function",
        function: {
                name: "compare_periods",
                description: "Compare demand between two time periods to detect growth or decline",
                parameters: {
                          type: "object",
                          properties: {
                                      productId: { type: "number", description: "The product ID" },
                                      period1Days: { type: "number", description: "First period in days (e.g. 30)" },
                                      period2Days: { type: "number", description: "Second period in days (e.g. 60)" },
                          },
                          required: ["productId", "period1Days", "period2Days"],
                },
        },
  },
  {
        type: "function",
        function: {
                name: "get_dashboard_kpis",
                description: "Get overall inventory KPIs: turnover ratio, stockout risk score, total value, dead stock",
                parameters: { type: "object", properties: {} },
        },
  },
  ];

// ─────────────────────────────────────────────
// TOOL EXECUTOR
// ─────────────────────────────────────────────
async function executeTool(name: string, args: any): Promise<{ result: any; toolName: string }> {
    let result: any;
    switch (name) {
      case "search_products":
              result = await tool_searchProducts(args.query || "", { lowStock: args.lowStock, category: args.category });
              break;
      case "get_stock_trend":
              result = await tool_getStockTrend(args.productId, args.days || 30);
              break;
      case "calculate_reorder":
              result = await tool_calculateReorder(args.productId);
              break;
      case "compare_periods":
              result = await tool_comparePeriods(args.productId, args.period1Days, args.period2Days);
              break;
      case "get_dashboard_kpis":
              result = await tool_getDashboardKPIs();
              break;
      default:
              result = { error: `Unknown tool: ${name}` };
    }
    return { result, toolName: name };
}

// ─────────────────────────────────────────────
// SESSION MEMORY (last 10 messages per session)
// ─────────────────────────────────────────────
const sessionMemory = new Map<string, OpenAI.Chat.ChatCompletionMessageParam[]>();

function getSessionHistory(sessionId: string): OpenAI.Chat.ChatCompletionMessageParam[] {
    return sessionMemory.get(sessionId) || [];
}

function updateSessionHistory(sessionId: string, message: OpenAI.Chat.ChatCompletionMessageParam): void {
    const history = getSessionHistory(sessionId);
    history.push(message);
    // Keep last 10 user+assistant exchanges = 20 messages max
  if (history.length > 20) history.splice(0, history.length - 20);
    sessionMemory.set(sessionId, history);
}

// ─────────────────────────────────────────────
// SYSTEM PROMPT
// ─────────────────────────────────────────────
function buildSystemPrompt(userRole: string, showPrices: boolean): string {
    return `You are an expert AI Inventory Copilot for EcoCut Smart Inventory — a world-class inventory intelligence system.

    Your capabilities:
    - Search and analyse products using real inventory data via tools
    - Calculate precise reorder recommendations using Economic Order Quantity (EOQ)
    - Detect demand trends, seasonal patterns, and stockout risks
    - Provide actionable, data-driven recommendations with confidence scores

    User role: ${userRole}
    ${showPrices ? "You may discuss pricing and financial values." : "Do NOT reveal unit prices or financial values to this user."}

    ALWAYS use the available tools to fetch real data before answering. Never guess or hallucinate inventory numbers.
    When you make a recommendation, state your confidence (0-100%) and the reasoning.
    Keep responses concise, structured, and actionable. Use bullet points for lists.
    If a product needs urgent reordering, clearly mark it as 🔴 CRITICAL or 🟡 HIGH priority.`;
}

// ─────────────────────────────────────────────
// EXTRACT ACTION SUGGESTIONS FROM AI RESPONSE
// ─────────────────────────────────────────────
function extractActionsFromResponse(response: string, toolResults: any[]): ChatAction[] {
    const actions: ChatAction[] = [];
    // Look for reorder suggestions in tool results
  toolResults.forEach(tr => {
        if (tr.toolName === "calculate_reorder" && tr.result?.productId) {
                const urgency = tr.result.urgency;
                if (urgency === "CRITICAL" || urgency === "HIGH") {
                          actions.push({
                                      type: "reorder",
                                      label: `Reorder ${tr.result.productName} (${tr.result.recommendedOrderQty} units)`,
                                      productId: tr.result.productId,
                                      productName: tr.result.productName,
                                      quantity: tr.result.recommendedOrderQty,
                          });
                }
                actions.push({
                          type: "view_product",
                          label: `View ${tr.result.productName}`,
                          productId: tr.result.productId,
                          productName: tr.result.productName,
                });
        }
        if (tr.toolName === "search_products" && Array.isArray(tr.result)) {
                tr.result.slice(0, 2).forEach((p: any) => {
                          actions.push({
                                      type: "view_product",
                                      label: `View ${p.name}`,
                                      productId: p.id,
                                      productName: p.name,
                          });
                });
        }
  });
    return actions.slice(0, 4); // max 4 action buttons
}

// ─────────────────────────────────────────────
// CONFIDENCE SCORING
// ─────────────────────────────────────────────
function calculateConfidence(toolsUsed: string[], responseLength: number, hasData: boolean): number {
    let score = 50;
    if (toolsUsed.length > 0) score += 25; // used real data
  if (hasData) score += 15;
    if (responseLength > 100) score += 10;
    return Math.min(100, score);
}

// ─────────────────────────────────────────────
// MAIN ORCHESTRATOR — AGENTIC TOOL-CALLING LOOP
// ─────────────────────────────────────────────
export class AIOrchestrator {
    async processQuery(
          userMessage: string,
          sessionId: string = "default",
          userRole: string = "admin",
          showPrices: boolean = true
        ): Promise<NLQueryResult> {
          const toolResults: { toolName: string; result: any }[] = [];
          const toolsUsed: string[] = [];

      try {
              // Build message history with system prompt
            const systemMessage: OpenAI.Chat.ChatCompletionMessageParam = {
                      role: "system",
                      content: buildSystemPrompt(userRole, showPrices),
            };

            const userMsg: OpenAI.Chat.ChatCompletionMessageParam = {
                      role: "user",
                      content: userMessage,
            };

            updateSessionHistory(sessionId, userMsg);
              const history = getSessionHistory(sessionId);

            const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
                      systemMessage,
                      ...history,
                    ];

            // ── AGENTIC LOOP: keep calling until no more tool calls ──
            let response = await openai.chat.completions.create({
                      model: "gpt-4o",
                      messages,
                      tools: INVENTORY_TOOLS,
                      tool_choice: "auto",
                      temperature: 0.2,
                      max_tokens: 1500,
            });

            let iterations = 0;
              while (response.choices[0].finish_reason === "tool_calls" && iterations < 5) {
                        iterations++;
                        const assistantMsg = response.choices[0].message;
                        messages.push(assistantMsg);

                // Execute all tool calls in parallel
                const toolCalls = assistantMsg.tool_calls || [];
                        const toolCallResults = await Promise.all(
                                    toolCalls.map(async (tc) => {
                                                  const args = JSON.parse(tc.function.arguments || "{}");
                                                  const { result, toolName } = await executeTool(tc.function.name, args);
                                                  toolResults.push({ toolName, result });
                                                  toolsUsed.push(tc.function.name);
                                                  return {
                                                                  role: "tool" as const,
                                                                  tool_call_id: tc.id,
                                                                  content: JSON.stringify(result),
                                                  };
                                    })
                                  );

                messages.push(...toolCallResults);

                // Continue the conversation
                response = await openai.chat.completions.create({
                            model: "gpt-4o",
                            messages,
                            tools: INVENTORY_TOOLS,
                            tool_choice: "auto",
                            temperature: 0.2,
                            max_tokens: 1500,
                });
              }

            const finalContent = response.choices[0].message.content || "I was unable to process your query.";

            // Save assistant response to session memory
            updateSessionHistory(sessionId, {
                      role: "assistant",
                      content: finalContent,
            });

            // Determine intent
            const lower = userMessage.toLowerCase();
              let intent: NLQueryResult["intent"] = "general";
              if (lower.includes("reorder") || lower.includes("order") || lower.includes("buy")) intent = "reorder";
              else if (lower.includes("forecast") || lower.includes("predict") || lower.includes("trend")) intent = "forecast";
              else if (lower.includes("search") || lower.includes("find") || lower.includes("show")) intent = "search";
              else if (lower.includes("analytic") || lower.includes("report") || lower.includes("kpi")) intent = "analytics";
              else if (lower.includes("recommend") || lower.includes("suggest") || lower.includes("should")) intent = "recommendation";

            const confidence = calculateConfidence(toolsUsed, finalContent.length, toolResults.length > 0);
              const actions = extractActionsFromResponse(finalContent, toolResults);

            return {
                      query: userMessage,
                      intent,
                      response: finalContent,
                      provider: "openai",
                      confidence,
                      actions,
                      toolsUsed,
                      data: toolResults.length > 0 ? toolResults[toolResults.length - 1].result : undefined,
            };
      } catch (error) {
              console.error("AI Orchestrator error:", error);
              // Fallback to Gemini
            try {
                      const geminiModel = gemini.models ? gemini : gemini;
                      const result = await (gemini as any).generateContent
                        ? (gemini as any).generateContent(userMessage)
                                  : null;
                      const fallbackText = result?.response?.text?.() || "I encountered an error. Please try again.";
                      return {
                                  query: userMessage,
                                  intent: "general",
                                  response: fallbackText,
                                  provider: "gemini",
                                  confidence: 40,
                                  actions: [],
                                  toolsUsed: [],
                      };
            } catch {
                      return {
                                  query: userMessage,
                                  intent: "general",
                                  response: "I'm having trouble connecting to the AI service. Please check your API keys and try again.",
                                  provider: "openai",
                                  confidence: 0,
                                  actions: [],
                                  toolsUsed: [],
                      };
            }
      }
    }

  clearSession(sessionId: string): void {
        sessionMemory.delete(sessionId);
  }
}

export const aiOrchestrator = new AIOrchestrator();
