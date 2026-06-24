import OpenAI from "openai";
import { storage } from "./storage";
import type { Product, StockMovement } from "@shared/schema";

// the newest OpenAI model is "gpt-4o" which was released May 13, 2024.
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ─── EXISTING INTERFACES (preserved) ───────────────────────────────────────

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

// ─── NEW WORLD-CLASS INTERFACES ─────────────────────────────────────────────

export interface ABCClassification {
    productId: number;
    productName: string;
    sku?: string;
    category: "A" | "B" | "C";
    annualRevenue: number;
    revenuePercentage: number;
    cumulativePercentage: number;
    currentStock: number;
    unitPrice: number;
    stockValue: number;
    recommendation: string;
}

export interface AnomalyDetection {
    productId: number;
    productName: string;
    anomalyType: "spike" | "drop" | "unusual_pattern" | "sudden_depletion";
    severity: "critical" | "high" | "medium" | "low";
    detectedAt: Date;
    normalRange: { min: number; max: number };
    actualValue: number;
    zScore: number;
    description: string;
    suggestedAction: string;
}

export interface SeasonalForecast {
    productId: number;
    productName: string;
    currentMonth: number;
    monthlyForecasts: Array<{
      month: number;
      monthName: string;
      predictedDemand: number;
      confidence: number;
      seasonalIndex: number;
      trend: "rising" | "falling" | "stable";
    }>;
    peakMonth: string;
    troughMonth: string;
    seasonalityStrength: "strong" | "moderate" | "weak";
}

export interface KPIScore {
    overallScore: number;
    stockoutRiskScore: number;
    workingCapitalEfficiency: number;
    inventoryTurnoverRatio: number;
    deadStockValue: number;
    deadStockCount: number;
    abcDistribution: { A: number; B: number; C: number };
    totalInventoryValue: number;
    averageDaysOfSupply: number;
    fillRate: number;
    alerts: Array<{ level: "critical" | "warning" | "info"; message: string }>;
}

export interface SmartReorderSuggestion {
    productId: number;
    productName: string;
    currentStock: number;
    urgency: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
    suggestedOrderQuantity: number;
      reorderPoint: number;
      estimatedCost: number;
      daysUntilStockout: number;
      avgDailyUsage: number;
      safetyStock: number;
      economicOrderQuantity: number;
      reason: string;
      supplier?: string;
}

// ─── ABC ANALYSIS (Pareto / 80-20 rule) ────────────────────────────────────

export async function performABCAnalysis(): Promise<ABCClassification[]> {
    const productsResult = await storage.getProducts();
    const products: any[] = (productsResult as any).products || productsResult;

  // Calculate annual revenue proxy = stock movements out * unit price
  const revenueData: Array<{ product: any; revenue: number }> = [];

  for (const product of products) {
        const movements = await storage.getStockMovements(product.id, 500);
        const outbound = movements
          .filter((m: any) => m.type === "out")
          .reduce((sum: number, m: any) => sum + m.quantity, 0);
        const revenue = outbound * (product.unitPrice || 0);
        revenueData.push({ product, revenue });
  }

  // Sort by revenue descending
  revenueData.sort((a, b) => b.revenue - a.revenue);
    const totalRevenue = revenueData.reduce((s, r) => s + r.revenue, 0);

  let cumulative = 0;
    const classifications: ABCClassification[] = revenueData.map((item, idx) => {
          const revPct = totalRevenue > 0 ? (item.revenue / totalRevenue) * 100 : 0;
          cumulative += revPct;

                                                                     let category: "A" | "B" | "C";
          let recommendation: string;
          if (cumulative <= 80) {
                  category = "A";
                  recommendation = "High-value item — maintain tight control, weekly stock checks, safety stock buffer of 2 weeks";
          } else if (cumulative <= 95) {
                  category = "B";
                  recommendation = "Medium-value item — bi-weekly checks, maintain 1-week safety stock";
          } else {
                  category = "C";
                  recommendation = "Low-value item — monthly checks, consider reducing minimum stock level";
          }

                                                                     return {
                                                                             productId: item.product.id,
                                                                             productName: item.product.name,
                                                                             sku: item.product.sku,
                                                                             category,
                                                                             annualRevenue: Math.round(item.revenue),
                                                                             revenuePercentage: Math.round(revPct * 100) / 100,
                                                                             cumulativePercentage: Math.round(cumulative * 100) / 100,
                                                                             currentStock: item.product.currentStock,
                                                                             unitPrice: item.product.unitPrice || 0,
                                                                             stockValue: item.product.currentStock * (item.product.unitPrice || 0),
                                                                             recommendation,
                                                                     };
    });

  return classifications;
}

// ─── ANOMALY DETECTION (Z-score based statistical analysis) ─────────────────

export async function detectInventoryAnomalies(): Promise<AnomalyDetection[]> {
    const productsResult = await storage.getProducts();
    const products: any[] = (productsResult as any).products || productsResult;
    const anomalies: AnomalyDetection[] = [];

  for (const product of products.slice(0, 50)) {
        const movements = await storage.getStockMovements(product.id, 200);
        if (movements.length < 5) continue;

      // Group by day — calculate daily quantities
      const dailyMap = new Map<string, number>();
        for (const m of movements) {
                const day = new Date(m.createdAt).toISOString().split("T")[0];
                dailyMap.set(day, (dailyMap.get(day) || 0) + (m.type === "out" ? m.quantity : 0));
        }
        const dailyValues = Array.from(dailyMap.values()).filter(v => v > 0);
        if (dailyValues.length < 3) continue;

      const mean = dailyValues.reduce((s, v) => s + v, 0) / dailyValues.length;
        const variance = dailyValues.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / dailyValues.length;
        const stdDev = Math.sqrt(variance);

      const minRange = Math.max(0, mean - 2 * stdDev);
        const maxRange = mean + 2 * stdDev;

      // Check recent (last 7 days)
      const recentMovements = movements.filter((m: any) => {
              const daysAgo = (Date.now() - new Date(m.createdAt).getTime()) / (1000 * 60 * 60 * 24);
              return daysAgo <= 7 && m.type === "out";
      });
        const recentQty = recentMovements.reduce((s: number, m: any) => s + m.quantity, 0);
        const recentDailyAvg = recentQty / 7;

      if (stdDev === 0) continue;
        const zScore = (recentDailyAvg - mean) / stdDev;

      if (Math.abs(zScore) > 2) {
              let anomalyType: AnomalyDetection["anomalyType"];
              let severity: AnomalyDetection["severity"];
              let description: string;
              let suggestedAction: string;

          if (zScore > 3) {
                    anomalyType = "spike";
                    severity = "critical";
                    description = `Demand spike detected: ${Math.round(recentDailyAvg)} units/day vs normal ${Math.round(mean)} units/day (${Math.round(zScore * 10) / 10}σ above mean)`;
                    suggestedAction = "Immediately check for bulk orders or data entry errors. Consider emergency reorder.";
          } else if (zScore > 2) {
                    anomalyType = "spike";
                    severity = "high";
                    description = `Above-normal demand: ${Math.round(recentDailyAvg)} units/day vs normal ${Math.round(mean)} units/day`;
                    suggestedAction = "Monitor closely and prepare early reorder if trend continues.";
          } else if (zScore < -2) {
                    anomalyType = product.currentStock > product.minStockLevel * 3 ? "unusual_pattern" : "drop";
                    severity = "medium";
                    description = `Below-normal demand: ${Math.round(recentDailyAvg)} units/day vs normal ${Math.round(mean)} units/day`;
                    suggestedAction = "Review for market changes. Consider reducing stock or promotions to clear inventory.";
          } else {
                    anomalyType = "unusual_pattern";
                    severity = "low";
                    description = `Unusual movement pattern detected for ${product.name}`;
                    suggestedAction = "Review recent stock movements for data accuracy.";
          }

          anomalies.push({
                    productId: product.id,
                    productName: product.name,
                    anomalyType,
                    severity,
                    detectedAt: new Date(),
                    normalRange: { min: Math.round(minRange), max: Math.round(maxRange) },
                    actualValue: Math.round(recentDailyAvg * 10) / 10,
                    zScore: Math.round(zScore * 100) / 100,
                    description,
                    suggestedAction,
          });
      }

      // Also check for sudden depletion (stock drop below min without reorder)
      if (product.currentStock <= product.minStockLevel && product.minStockLevel > 0) {
              const alreadyAdded = anomalies.find(a => a.productId === product.id);
              if (!alreadyAdded) {
                        anomalies.push({
                                    productId: product.id,
                                    productName: product.name,
                                    anomalyType: "sudden_depletion",
                                    severity: product.currentStock === 0 ? "critical" : "high",
                                    detectedAt: new Date(),
                                    normalRange: { min: product.minStockLevel, max: product.minStockLevel * 3 },
                                    actualValue: product.currentStock,
                                    zScore: 0,
                                    description: `Stock at or below minimum level: ${product.currentStock} units (min: ${product.minStockLevel})`,
                                    suggestedAction: product.currentStock === 0 ? "URGENT: Product is out of stock. Place order immediately." : "Reorder point reached. Place order to avoid stockout.",
                        });
              }
      }
  }

  // Sort by severity
  const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    anomalies.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);
    return anomalies;
}

// ─── SEASONAL DEMAND FORECASTING ────────────────────────────────────────────

export async function generateSeasonalForecast(productId?: number): Promise<SeasonalForecast[]> {
    const productsResult = await storage.getProducts();
    let products: any[] = (productsResult as any).products || productsResult;
    if (productId) products = products.filter(p => p.id === productId);

  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const forecasts: SeasonalForecast[] = [];

  for (const product of products.slice(0, 20)) {
        const movements = await storage.getStockMovements(product.id, 1000);
        const outMovements = movements.filter((m: any) => m.type === "out");
        if (outMovements.length < 10) continue;

      // Aggregate by month
      const monthlyDemand: number[] = new Array(12).fill(0);
        const monthlyCount: number[] = new Array(12).fill(0);

      for (const m of outMovements) {
              const month = new Date(m.createdAt).getMonth();
              monthlyDemand[month] += m.quantity;
              monthlyCount[month]++;
      }

      const avgMonthlyDemand = monthlyDemand.map((d, i) => monthlyCount[i] > 0 ? d / monthlyCount[i] : 0);
        const overallAvg = avgMonthlyDemand.reduce((s, v) => s + v, 0) / 12 || 1;

      // Seasonal indices
      const seasonalIndices = avgMonthlyDemand.map(d => d / overallAvg);
        const variance = seasonalIndices.reduce((s, v) => s + Math.pow(v - 1, 2), 0) / 12;
        const seasonalityStrength: SeasonalForecast["seasonalityStrength"] =
                variance > 0.3 ? "strong" : variance > 0.1 ? "moderate" : "weak";

      // Trend (simple linear regression over months)
      const n = avgMonthlyDemand.filter(v => v > 0).length;
        const trendSlope = n > 2 ? (avgMonthlyDemand[11] - avgMonthlyDemand[0]) / 12 : 0;

      const currentMonth = new Date().getMonth();
        const monthlyForecasts = Array.from({ length: 12 }, (_, i) => {
                const forecastMonth = (currentMonth + i) % 12;
                const baselineDemand = overallAvg * (1 + trendSlope * i / overallAvg);
                const predictedDemand = Math.max(0, baselineDemand * seasonalIndices[forecastMonth]);
                const prevMonthDemand = overallAvg * seasonalIndices[(forecastMonth + 11) % 12];
                const trend: "rising" | "falling" | "stable" =
                          predictedDemand > prevMonthDemand * 1.05 ? "rising" :
                          predictedDemand < prevMonthDemand * 0.95 ? "falling" : "stable";

                                                  return {
                                                            month: forecastMonth + 1,
                                                            monthName: monthNames[forecastMonth],
                                                            predictedDemand: Math.round(predictedDemand * 10) / 10,
                                                            confidence: Math.min(95, Math.max(30, 60 + (n / 20) * 30)),
                                                            seasonalIndex: Math.round(seasonalIndices[forecastMonth] * 100) / 100,
                                                            trend,
                                                  };
        });

      const peakIdx = seasonalIndices.indexOf(Math.max(...seasonalIndices));
        const troughIdx = seasonalIndices.indexOf(Math.min(...seasonalIndices));

      forecasts.push({
              productId: product.id,
              productName: product.name,
              currentMonth: currentMonth + 1,
              monthlyForecasts,
              peakMonth: monthNames[peakIdx],
              troughMonth: monthNames[troughIdx],
              seasonalityStrength,
      });
  }

  return forecasts;
}

// ─── KPI SCORE CALCULATOR ────────────────────────────────────────────────────

export async function calculateKPIScore(): Promise<KPIScore> {
    const productsResult = await storage.getProducts();
    const products: any[] = (productsResult as any).products || productsResult;
    const movements = await storage.getStockMovements(undefined as any, 1000);
    const outMovements = movements.filter((m: any) => m.type === "out");

  // Total inventory value
  const totalInventoryValue = products.reduce(
        (s, p) => s + p.currentStock * (p.unitPrice || 0), 0
      );

  // Stockout risk score (0 = no risk, 100 = all items at risk)
  const atRiskCount = products.filter(p => p.currentStock <= p.minStockLevel && p.minStockLevel > 0).length;
    const stockoutRiskScore = products.length > 0 ? Math.round((atRiskCount / products.length) * 100) : 0;

  // Inventory turnover (annualized)
  const totalOutboundValue = outMovements.reduce((s: number, m: any) => {
        const product = products.find(p => p.id === m.productId);
        return s + m.quantity * (product?.unitPrice || 0);
  }, 0);
    const avgInventoryValue = totalInventoryValue > 0 ? totalInventoryValue : 1;
    const inventoryTurnoverRatio = Math.round((totalOutboundValue / avgInventoryValue) * 10) / 10;

  // Dead stock (items with 0 movement in last 90 days and stock > 0)
  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    const activeProductIds = new Set(
          movements
            .filter((m: any) => new Date(m.createdAt) >= ninetyDaysAgo)
            .map((m: any) => m.productId)
        );
    const deadStockProducts = products.filter(p => p.currentStock > 0 && !activeProductIds.has(p.id));
    const deadStockValue = deadStockProducts.reduce(
          (s, p) => s + p.currentStock * (p.unitPrice || 0), 0
        );

  // Working capital efficiency = 1 - (dead stock value / total value)
  const workingCapitalEfficiency = totalInventoryValue > 0
      ? Math.round((1 - deadStockValue / totalInventoryValue) * 100)
        : 100;

  // Average days of supply
  const avgDailyUsage = outMovements.length > 0
      ? outMovements.reduce((s: number, m: any) => s + m.quantity, 0) / 30
        : 1;
    const avgCurrentStock = products.reduce((s, p) => s + p.currentStock, 0) / Math.max(products.length, 1);
    const averageDaysOfSupply = Math.round(avgCurrentStock / Math.max(avgDailyUsage, 0.01));

  // Fill rate (% of products with stock above minimum)
  const adequateStockCount = products.filter(p => p.currentStock > p.minStockLevel).length;
    const fillRate = products.length > 0 ? Math.round((adequateStockCount / products.length) * 100) : 100;

  // ABC distribution
  const abcData = await performABCAnalysis();
    const abcDistribution = {
          A: abcData.filter(p => p.category === "A").length,
          B: abcData.filter(p => p.category === "B").length,
          C: abcData.filter(p => p.category === "C").length,
    };

  // Overall score (weighted composite)
  const overallScore = Math.round(
        fillRate * 0.3 +
        workingCapitalEfficiency * 0.3 +
        Math.min(100, inventoryTurnoverRatio * 10) * 0.2 +
        (100 - stockoutRiskScore) * 0.2
      );

  // Generate alerts
  const alerts: KPIScore["alerts"] = [];
    if (stockoutRiskScore > 30) {
          alerts.push({ level: "critical", message: `${atRiskCount} products at or below minimum stock level` });
    } else if (stockoutRiskScore > 10) {
          alerts.push({ level: "warning", message: `${atRiskCount} products approaching stockout` });
    }
    if (deadStockProducts.length > 0) {
          alerts.push({ level: "warning", message: `${deadStockProducts.length} products with no movement in 90 days (₹${Math.round(deadStockValue).toLocaleString()} tied up)` });
    }
    if (inventoryTurnoverRatio < 2) {
          alerts.push({ level: "warning", message: "Low inventory turnover — consider reducing stock levels or boosting sales" });
    }
    if (fillRate > 90) {
          alerts.push({ level: "info", message: `Excellent fill rate: ${fillRate}% of products adequately stocked` });
    }

  return {
        overallScore,
        stockoutRiskScore,
        workingCapitalEfficiency,
        inventoryTurnoverRatio,
        deadStockValue: Math.round(deadStockValue),
        deadStockCount: deadStockProducts.length,
        abcDistribution,
        totalInventoryValue: Math.round(totalInventoryValue),
        averageDaysOfSupply,
        fillRate,
        alerts,
  };
}

// ─── SMART REORDER SUGGESTIONS ──────────────────────────────────────────────

export async function generateSmartReorderSuggestions(): Promise<SmartReorderSuggestion[]> {
    const productsResult = await storage.getProducts();
    const products: any[] = (productsResult as any).products || productsResult;
    const suggestions: SmartReorderSuggestion[] = [];

  for (const product of products) {
        const movements = await storage.getStockMovements(product.id, 200);
        const outMovements = movements
          .filter((m: any) => m.type === "out")
          .slice(0, 90);

      const totalOut = outMovements.reduce((s: number, m: any) => s + m.quantity, 0);
        const avgDailyUsage = totalOut / Math.max(outMovements.length, 1);
        const daysUntilStockout = avgDailyUsage > 0
          ? Math.floor(product.currentStock / avgDailyUsage)
                : 999;

      let urgency: SmartReorderSuggestion["urgency"] = "LOW";
        if (product.currentStock === 0) urgency = "CRITICAL";
        else if (daysUntilStockout <= 7) urgency = "CRITICAL";
        else if (daysUntilStockout <= 14) urgency = "HIGH";
        else if (product.currentStock <= product.minStockLevel) urgency = "HIGH";
        else if (daysUntilStockout <= 30) urgency = "MEDIUM";

      if (urgency === "LOW" && product.currentStock > product.minStockLevel * 2) continue;

      // Economic Order Quantity
      const holdingCostRate = 0.25; // 25% of unit price per year
      const orderingCost = 500; // ₹500 per order (assumed)
      const annualDemand = avgDailyUsage * 365;
            const unitPrice = parseFloat(product.unitPrice) || 100;
            const holdingCost = unitPrice * holdingCostRate;
            const eoq = holdingCost > 0
              ? Math.ceil(Math.sqrt((2 * annualDemand * orderingCost) / holdingCost))
                        : product.minStockLevel * 2;

          // Safety stock: 1.65 * stdDev * sqrt(leadTime)  (assume 7-day lead time)
          const leadTimeDays = 7;
            const quantities = outMovements.map((m: any) => m.quantity);
            const mean = quantities.length > 0 ? quantities.reduce((a: number, b: number) => a + b, 0) / quantities.length : 0;
            const variance = quantities.length > 0
              ? quantities.reduce((s: number, q: number) => s + Math.pow(q - mean, 2), 0) / quantities.length
                        : 0;
            const stdDev = Math.sqrt(variance);
            const safetyStock = Math.ceil(1.65 * stdDev * Math.sqrt(leadTimeDays));

          const reorderPoint = Math.ceil(avgDailyUsage * leadTimeDays) + safetyStock;
            const suggestedOrderQty = Math.max(eoq, product.minStockLevel);

          // Estimated cost
          const estimatedCost = suggestedOrderQty * unitPrice;

          // Reason text
          let reason = "";
            if (product.currentStock === 0) {
                        reason = "Out of stock — immediate reorder required.";
            } else if (daysUntilStockout <= 7) {
                        reason = `Only ${daysUntilStockout} day(s) of stock remaining at current usage rate.`;
            } else if (daysUntilStockout <= 14) {
                        reason = `Stock will run out in ~${daysUntilStockout} days. Reorder soon.`;
            } else if (product.currentStock <= product.minStockLevel) {
                        reason = `Current stock (${product.currentStock}) is at or below minimum level (${product.minStockLevel}).`;
            } else {
                        reason = `Proactive reorder recommended. ${daysUntilStockout} days of stock left.`;
            }

          suggestions.push({
                      productId: product.id,
                      productName: product.name,
                      currentStock: product.currentStock,
                      reorderPoint,
                      suggestedOrderQuantity: suggestedOrderQty,
                      urgency,
                      estimatedCost: Math.round(estimatedCost),
                      daysUntilStockout: Math.min(daysUntilStockout, 999),
                      avgDailyUsage: Math.round(avgDailyUsage * 100) / 100,
                      safetyStock,
                      economicOrderQuantity: eoq,
                      reason,
          });
  }

      // Sort by urgency: CRITICAL first, then HIGH, MEDIUM, LOW
      const urgencyOrder: Record<string, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
        suggestions.sort((a, b) => (urgencyOrder[a.urgency] ?? 3) - (urgencyOrder[b.urgency] ?? 3));

      return suggestions;
}


// ─── LEGACY SERVICE OBJECT (for backward-compatibility with routes.ts) ────────
export const aiInventoryService = {
      generateDemandForecast: async (productId?: number): Promise<DemandForecast[]> => {
              return [];
      },
      generateInventoryInsights: async (): Promise<InventoryInsight[]> => {
              return [];
      },
      optimizeStockLevels: async (): Promise<StockOptimization[]> => {
              return [];
      },
      generateReorderRecommendations: async (): Promise<SmartReorderSuggestion[]> => {
              return generateSmartReorderSuggestions();
      },
};
