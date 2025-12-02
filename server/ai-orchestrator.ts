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
}

export interface NLQueryResult {
  query: string;
  intent: "search" | "analytics" | "recommendation" | "general";
  response: string;
  data?: any;
  provider: AIProvider;
  confidence: number;
}

export interface VendorRecommendation {
  vendorName: string;
  score: number;
  priceRating: number;
  deliveryRating: number;
  qualityRating: number;
  reasoning: string;
  estimatedCost: string;
  deliveryTime: string;
}

export interface DocumentExtraction {
  documentType: "invoice" | "purchase_order" | "delivery_note" | "unknown";
  vendor?: string;
  date?: string;
  items: Array<{
    name: string;
    quantity: number;
    unitPrice: number;
    total: number;
  }>;
  totalAmount?: number;
  invoiceNumber?: string;
  confidence: number;
  rawText: string;
}

export interface PredictiveAnalytics {
  productId: number;
  productName: string;
  historicalData: Array<{ date: string; quantity: number }>;
  forecast: Array<{ date: string; predictedQuantity: number; confidence: number }>;
  seasonalityPattern: string;
  trend: "increasing" | "decreasing" | "stable";
  anomalies: string[];
}

export interface AlertInsight {
  productId: number;
  productName: string;
  alertType: "critical_low" | "out_of_stock" | "overstock" | "expiring";
  severity: "critical" | "warning" | "info";
  message: string;
  aiRecommendation: string;
  actionRequired: boolean;
}

class AIOrchestrator {
  private conversationHistory: Map<string, ChatMessage[]> = new Map();

  async generateWithProvider(
    prompt: string,
    provider: AIProvider = "auto",
    jsonMode: boolean = false
  ): Promise<{ text: string; provider: AIProvider }> {
    const actualProvider = provider === "auto" ? this.selectOptimalProvider(prompt) : provider;

    try {
      if (actualProvider === "gemini") {
        return await this.generateWithGemini(prompt, jsonMode);
      } else {
        return await this.generateWithOpenAI(prompt, jsonMode);
      }
    } catch (error) {
      console.error(`Error with ${actualProvider}, falling back:`, error);
      // Fallback to other provider
      if (actualProvider === "gemini") {
        return await this.generateWithOpenAI(prompt, jsonMode);
      } else {
        return await this.generateWithGemini(prompt, jsonMode);
      }
    }
  }

  private selectOptimalProvider(prompt: string): AIProvider {
    // Use Gemini for longer context and document analysis
    // Use OpenAI for structured JSON responses and complex reasoning
    if (prompt.length > 4000 || prompt.includes("document") || prompt.includes("PDF")) {
      return "gemini";
    }
    return "openai";
  }

  private async generateWithOpenAI(prompt: string, jsonMode: boolean): Promise<{ text: string; provider: AIProvider }> {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: prompt }],
      ...(jsonMode && { response_format: { type: "json_object" } }),
    });
    return { text: response.choices[0].message.content || "", provider: "openai" };
  }

  private async generateWithGemini(prompt: string, jsonMode: boolean): Promise<{ text: string; provider: AIProvider }> {
    const response = await gemini.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      ...(jsonMode && { 
        config: { 
          responseMimeType: "application/json" 
        } 
      }),
    });
    return { text: response.text || "", provider: "gemini" };
  }

  // Natural Language Query Processing
  async processNaturalLanguageQuery(query: string, userId: string): Promise<NLQueryResult> {
    const products = await storage.getProducts();
    const categories = await storage.getCategories();
    const stats = await storage.getDashboardStats();

    const systemPrompt = `You are an intelligent inventory management assistant. Analyze the user's natural language query and provide helpful information.

Available Data Context:
- Total Products: ${stats.totalProducts}
- Total Categories: ${categories.length}
- Low Stock Items: ${stats.lowStockItems}
- Out of Stock: ${stats.outOfStockItems}
- Total Inventory Value: ₹${stats.totalValue}

Product Categories: ${categories.map(c => c.name).join(", ")}

Sample Products: ${products.products.slice(0, 10).map(p => `${p.name} (Stock: ${p.currentStock}, Price: ₹${p.unitPrice})`).join("; ")}

User Query: "${query}"

Analyze the query intent and provide a helpful response. Return JSON:
{
  "intent": "search|analytics|recommendation|general",
  "response": "Your helpful response addressing the user's query",
  "data": null or relevant data object,
  "confidence": 0.0 to 1.0
}`;

    const { text, provider } = await this.generateWithProvider(systemPrompt, "auto", true);
    
    try {
      const result = JSON.parse(text);
      return {
        query,
        intent: result.intent || "general",
        response: result.response || "I couldn't process your query. Please try rephrasing.",
        data: result.data,
        provider,
        confidence: result.confidence || 0.5
      };
    } catch {
      return {
        query,
        intent: "general",
        response: text,
        provider,
        confidence: 0.5
      };
    }
  }

  // Chat conversation management
  async chat(sessionId: string, message: string, userId: string): Promise<ChatMessage> {
    if (!this.conversationHistory.has(sessionId)) {
      this.conversationHistory.set(sessionId, []);
    }

    const history = this.conversationHistory.get(sessionId)!;
    
    // Add user message
    const userMessage: ChatMessage = {
      role: "user",
      content: message,
      timestamp: new Date()
    };
    history.push(userMessage);

    // Get inventory context
    const stats = await storage.getDashboardStats();
    const products = await storage.getProducts();
    const lowStockProducts = products.products.filter(p => p.currentStock <= (p.minStockLevel || 10));

    const systemContext = `You are StockFlow AI Assistant, an intelligent inventory management helper. You have access to real-time inventory data.

Current Inventory Status:
- Total Products: ${stats.totalProducts}
- Low Stock Alerts: ${stats.lowStockItems}
- Out of Stock: ${stats.outOfStockItems}
- Total Value: ₹${stats.totalValue}

${lowStockProducts.length > 0 ? `Low Stock Products: ${lowStockProducts.slice(0, 5).map(p => p.name).join(", ")}` : "All products are adequately stocked."}

Previous conversation:
${history.slice(-6).map(m => `${m.role}: ${m.content}`).join("\n")}

Respond helpfully and concisely. Use Indian Rupee (₹) for currency. Be proactive in suggesting actions when relevant.`;

    const { text, provider } = await this.generateWithProvider(
      `${systemContext}\n\nUser: ${message}\n\nAssistant:`,
      "auto",
      false
    );

    const assistantMessage: ChatMessage = {
      role: "assistant",
      content: text,
      timestamp: new Date(),
      provider
    };
    history.push(assistantMessage);

    // Keep only last 20 messages
    if (history.length > 20) {
      this.conversationHistory.set(sessionId, history.slice(-20));
    }

    return assistantMessage;
  }

  // Predictive Analytics
  async generatePredictiveAnalytics(productId?: number): Promise<PredictiveAnalytics[]> {
    const products = productId 
      ? [await storage.getProduct(productId)]
      : (await storage.getProducts()).products.slice(0, 8);

    const analytics: PredictiveAnalytics[] = [];

    for (const product of products) {
      if (!product) continue;

      const movements = await storage.getStockMovements(product.id, 60);
      
      // Group movements by date for historical data
      const dailyData = new Map<string, number>();
      movements.forEach(m => {
        const date = new Date(m.createdAt!).toISOString().split('T')[0];
        const current = dailyData.get(date) || 0;
        dailyData.set(date, current + (m.type === 'OUT' ? m.quantity : -m.quantity));
      });

      const historicalData = Array.from(dailyData.entries())
        .map(([date, quantity]) => ({ date, quantity: Math.abs(quantity) }))
        .sort((a, b) => a.date.localeCompare(b.date));

      const prompt = `Analyze inventory movement patterns and generate a 7-day forecast:

Product: ${product.name}
Current Stock: ${product.currentStock}
Min Stock Level: ${product.minStockLevel || 10}
Historical Movement Data: ${JSON.stringify(historicalData.slice(-30))}

Generate a forecast with JSON:
{
  "forecast": [
    {"date": "YYYY-MM-DD", "predictedQuantity": number, "confidence": 0.0-1.0}
  ],
  "seasonalityPattern": "weekly|monthly|quarterly|none",
  "trend": "increasing|decreasing|stable",
  "anomalies": ["list of unusual patterns detected"]
}

Generate forecast for next 7 days starting from today.`;

      try {
        const { text } = await this.generateWithProvider(prompt, "gemini", true);
        const result = JSON.parse(text);

        analytics.push({
          productId: product.id,
          productName: product.name,
          historicalData: historicalData.slice(-14),
          forecast: result.forecast || [],
          seasonalityPattern: result.seasonalityPattern || "none",
          trend: result.trend || "stable",
          anomalies: result.anomalies || []
        });
      } catch (error) {
        console.error(`Error generating analytics for ${product.name}:`, error);
      }
    }

    return analytics;
  }

  // Vendor Recommendations
  async getVendorRecommendations(productName: string, quantity: number): Promise<VendorRecommendation[]> {
    const prompt = `As an AI inventory advisor, suggest potential vendors for restocking:

Product: ${productName}
Required Quantity: ${quantity}

Generate 3-5 vendor recommendations based on typical Indian market conditions. Consider:
- Price competitiveness
- Delivery reliability
- Quality track record

Return JSON array:
[{
  "vendorName": "Vendor Name",
  "score": 0-100,
  "priceRating": 1-5,
  "deliveryRating": 1-5,
  "qualityRating": 1-5,
  "reasoning": "Why this vendor is recommended",
  "estimatedCost": "₹X,XXX - ₹Y,YYY",
  "deliveryTime": "X-Y days"
}]

Note: These are simulated recommendations based on typical market patterns.`;

    try {
      const { text } = await this.generateWithProvider(prompt, "openai", true);
      return JSON.parse(text);
    } catch {
      return [];
    }
  }

  // Document Processing (Invoice/PO extraction)
  async extractDocumentData(textContent: string, documentType?: string): Promise<DocumentExtraction> {
    const prompt = `Extract structured data from this document:

Document Content:
${textContent.slice(0, 8000)}

Extract and return JSON:
{
  "documentType": "invoice|purchase_order|delivery_note|unknown",
  "vendor": "vendor name if found",
  "date": "date in YYYY-MM-DD format",
  "items": [
    {"name": "item name", "quantity": number, "unitPrice": number, "total": number}
  ],
  "totalAmount": total amount as number,
  "invoiceNumber": "document reference number",
  "confidence": 0.0-1.0 based on extraction quality
}`;

    try {
      const { text } = await this.generateWithProvider(prompt, "gemini", true);
      const result = JSON.parse(text);
      return {
        ...result,
        rawText: textContent.slice(0, 1000)
      };
    } catch {
      return {
        documentType: "unknown",
        items: [],
        confidence: 0,
        rawText: textContent.slice(0, 1000)
      };
    }
  }

  // Generate Alert Insights
  async generateAlertInsights(): Promise<AlertInsight[]> {
    const products = await storage.getProducts();
    const alerts: AlertInsight[] = [];

    const criticalProducts = products.products.filter(p => 
      p.currentStock === 0 || p.currentStock <= (p.minStockLevel || 10) * 0.5
    );

    const lowStockProducts = products.products.filter(p => 
      p.currentStock > 0 && 
      p.currentStock <= (p.minStockLevel || 10) &&
      p.currentStock > (p.minStockLevel || 10) * 0.5
    );

    const overstockProducts = products.products.filter(p => 
      p.currentStock > (p.maxStockLevel || 1000) * 0.9
    );

    for (const product of [...criticalProducts, ...lowStockProducts, ...overstockProducts].slice(0, 10)) {
      const isCritical = product.currentStock === 0;
      const isLow = product.currentStock <= (product.minStockLevel || 10);
      const isOverstock = product.currentStock > (product.maxStockLevel || 1000) * 0.9;

      const prompt = `Generate a brief, actionable recommendation for this inventory alert:

Product: ${product.name}
Current Stock: ${product.currentStock}
Min Level: ${product.minStockLevel || 10}
Max Level: ${product.maxStockLevel || 1000}
Unit Price: ₹${product.unitPrice}
Status: ${isCritical ? "OUT OF STOCK" : isLow ? "LOW STOCK" : "OVERSTOCK"}

Provide a 1-2 sentence actionable recommendation.`;

      try {
        const { text } = await this.generateWithProvider(prompt, "openai", false);
        
        alerts.push({
          productId: product.id,
          productName: product.name,
          alertType: isCritical ? "out_of_stock" : isLow ? "critical_low" : "overstock",
          severity: isCritical ? "critical" : isLow ? "warning" : "info",
          message: isCritical 
            ? `${product.name} is out of stock!`
            : isLow 
            ? `${product.name} is running low (${product.currentStock} remaining)`
            : `${product.name} may be overstocked (${product.currentStock} units)`,
          aiRecommendation: text.trim(),
          actionRequired: isCritical || isLow
        });
      } catch (error) {
        console.error(`Error generating alert for ${product.name}:`, error);
      }
    }

    return alerts;
  }

  // Voice query processing (text already converted from speech)
  async processVoiceQuery(transcription: string, userId: string): Promise<NLQueryResult> {
    // Process voice transcription as natural language query
    return this.processNaturalLanguageQuery(transcription, userId);
  }

  // Clear chat history for a session
  clearChatHistory(sessionId: string): void {
    this.conversationHistory.delete(sessionId);
  }

  // Get chat history
  getChatHistory(sessionId: string): ChatMessage[] {
    return this.conversationHistory.get(sessionId) || [];
  }
}

export const aiOrchestrator = new AIOrchestrator();
