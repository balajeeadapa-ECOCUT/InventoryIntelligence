import OpenAI from "openai";
import { storage } from "./storage";
import type { Product, StockMovement } from "@shared/schema";

// the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export interface DemandForecast {
  productId: number;
  productName: string;
  currentStock: number;
  predictedDemand: number;
  daysUntilStockout: number;
  recommendedReorderQuantity: number;
  confidence: number;
  reasoning: string;
}

export interface InventoryInsight {
  type: "reorder_alert" | "overstock_warning" | "trend_analysis" | "optimization";
  title: string;
  description: string;
  priority: "high" | "medium" | "low";
  actionRequired: boolean;
  products?: string[];
}

export interface StockOptimization {
  productId: number;
  productName: string;
  currentStock: number;
  optimalStock: number;
  adjustment: number;
  reasoning: string;
  costImpact: string;
}

export class AIInventoryService {
  async generateDemandForecast(productId?: number): Promise<DemandForecast[]> {
    try {
      // Get products and their stock movement history
      const products = productId 
        ? [await storage.getProduct(productId)]
        : (await storage.getProducts()).products;
      
      const forecasts: DemandForecast[] = [];

      for (const product of products) {
        if (!product) continue;

        // Get stock movement history for the product
        const movements = await storage.getStockMovements(product.id, 100);
        
        // Prepare data for AI analysis
        const movementData = movements.map(m => ({
          date: m.createdAt,
          type: m.type,
          quantity: m.quantity,
          reason: m.reason
        }));

        const prompt = `
        Analyze this product's inventory data and predict future demand:
        
        Product: ${product.name}
        Current Stock: ${product.currentStock}
        Minimum Stock Level: ${product.minStockLevel || 10}
        Recent Stock Movements: ${JSON.stringify(movementData.slice(0, 20))}
        
        Based on the historical data, predict:
        1. Daily demand rate
        2. Days until stockout at current rate
        3. Recommended reorder quantity
        4. Confidence level (0-1)
        5. Brief reasoning
        
        Respond with JSON in this format:
        {
          "predictedDemand": number,
          "daysUntilStockout": number,
          "recommendedReorderQuantity": number,
          "confidence": number,
          "reasoning": "brief explanation"
        }
        `;

        const response = await openai.chat.completions.create({
          model: "gpt-4o",
          messages: [{ role: "user", content: prompt }],
          response_format: { type: "json_object" },
        });

        const result = JSON.parse(response.choices[0].message.content || "{}");

        forecasts.push({
          productId: product.id,
          productName: product.name,
          currentStock: product.currentStock,
          predictedDemand: result.predictedDemand || 0,
          daysUntilStockout: result.daysUntilStockout || 0,
          recommendedReorderQuantity: result.recommendedReorderQuantity || 0,
          confidence: Math.max(0, Math.min(1, result.confidence || 0.5)),
          reasoning: result.reasoning || "Analysis based on historical data"
        });
      }

      return forecasts;
    } catch (error) {
      console.error("Error generating demand forecast:", error);
      return [];
    }
  }

  async generateInventoryInsights(): Promise<InventoryInsight[]> {
    try {
      const stats = await storage.getDashboardStats();
      const products = await storage.getProducts();
      const recentMovements = await storage.getStockMovements(undefined, 50);

      const lowStockProducts = products.products.filter(p => 
        p.currentStock <= (p.minStockLevel || 10)
      );

      const prompt = `
      Analyze this inventory system and provide actionable insights:
      
      Overall Stats:
      - Total Products: ${stats.totalProducts}
      - Low Stock Items: ${stats.lowStockItems}
      - Out of Stock Items: ${stats.outOfStockItems}
      - Total Inventory Value: ₹${stats.totalValue}
      
      Low Stock Products: ${lowStockProducts.map(p => `${p.name} (${p.currentStock} remaining)`).join(", ")}
      
      Recent Activity: ${recentMovements.slice(0, 10).map(m => 
        `${m.type} ${m.quantity} of ${m.product.name} - ${m.reason}`
      ).join("; ")}
      
      Generate 3-5 actionable insights about inventory management, focusing on:
      1. Urgent reorder alerts
      2. Overstock warnings
      3. Trend analysis
      4. Optimization opportunities
      
      Respond with JSON array of insights:
      [{
        "type": "reorder_alert|overstock_warning|trend_analysis|optimization",
        "title": "Brief title",
        "description": "Detailed description with specific recommendations",
        "priority": "high|medium|low",
        "actionRequired": boolean,
        "products": ["product names if applicable"]
      }]
      `;

      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
      });

      const result = JSON.parse(response.choices[0].message.content || "{}");
      return result.insights || [];
    } catch (error) {
      console.error("Error generating inventory insights:", error);
      return [];
    }
  }

  async optimizeStockLevels(): Promise<StockOptimization[]> {
    try {
      const products = await storage.getProducts();
      const optimizations: StockOptimization[] = [];

      for (const product of products.products.slice(0, 10)) { // Limit to 10 for cost
        const movements = await storage.getStockMovements(product.id, 30);
        
        const prompt = `
        Optimize stock levels for this product:
        
        Product: ${product.name}
        Current Stock: ${product.currentStock}
        Minimum Stock: ${product.minStockLevel || 10}
        Unit Price: ₹${product.unitPrice}
        
        Recent Movements: ${movements.slice(0, 15).map(m => 
          `${m.type} ${m.quantity} on ${m.createdAt}`
        ).join("; ")}
        
        Calculate optimal stock level considering:
        1. Demand patterns
        2. Storage costs
        3. Stockout risks
        4. Order frequency
        
        Respond with JSON:
        {
          "optimalStock": number,
          "adjustment": number,
          "reasoning": "explanation of optimization",
          "costImpact": "estimated cost savings or investment needed"
        }
        `;

        const response = await openai.chat.completions.create({
          model: "gpt-4o",
          messages: [{ role: "user", content: prompt }],
          response_format: { type: "json_object" },
        });

        const result = JSON.parse(response.choices[0].message.content || "{}");

        optimizations.push({
          productId: product.id,
          productName: product.name,
          currentStock: product.currentStock,
          optimalStock: result.optimalStock || product.currentStock,
          adjustment: result.adjustment || 0,
          reasoning: result.reasoning || "Analysis based on demand patterns",
          costImpact: result.costImpact || "Minimal impact expected"
        });
      }

      return optimizations;
    } catch (error) {
      console.error("Error optimizing stock levels:", error);
      return [];
    }
  }

  async generateReorderRecommendations(): Promise<DemandForecast[]> {
    const forecasts = await this.generateDemandForecast();
    return forecasts.filter(f => 
      f.daysUntilStockout <= 14 || f.currentStock <= 10
    );
  }
}

export const aiInventoryService = new AIInventoryService();