import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Brain, TrendingUp, AlertTriangle, Package, Zap, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface DemandForecast {
  productId: number;
  productName: string;
  currentStock: number;
  predictedDemand: number;
  daysUntilStockout: number;
  recommendedReorderQuantity: number;
  confidence: number;
  reasoning: string;
}

interface InventoryInsight {
  type: "reorder_alert" | "overstock_warning" | "trend_analysis" | "optimization";
  title: string;
  description: string;
  priority: "high" | "medium" | "low";
  actionRequired: boolean;
  products?: string[];
}

interface StockOptimization {
  productId: number;
  productName: string;
  currentStock: number;
  optimalStock: number;
  adjustment: number;
  reasoning: string;
  costImpact: string;
}

export default function AIInsights() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("insights");

  const { data: insights, isLoading: insightsLoading, refetch: refetchInsights } = useQuery({
    queryKey: ["/api/ai/inventory-insights"],
    retry: false,
  });

  const { data: forecasts, isLoading: forecastsLoading, refetch: refetchForecasts } = useQuery({
    queryKey: ["/api/ai/demand-forecast"],
    retry: false,
  });

  const { data: optimizations, isLoading: optimizationsLoading, refetch: refetchOptimizations } = useQuery({
    queryKey: ["/api/ai/stock-optimization"],
    retry: false,
  });

  const { data: recommendations, isLoading: recommendationsLoading, refetch: refetchRecommendations } = useQuery({
    queryKey: ["/api/ai/reorder-recommendations"],
    retry: false,
  });

  const refreshAllData = async () => {
    try {
      await Promise.all([
        refetchInsights(),
        refetchForecasts(),
        refetchOptimizations(),
        refetchRecommendations()
      ]);
      toast({
        title: "AI Analysis Updated",
        description: "All AI insights have been refreshed with latest data.",
      });
    } catch (error) {
      toast({
        title: "Update Failed",
        description: "Failed to refresh AI insights. Please try again.",
        variant: "destructive",
      });
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "high": return "destructive";
      case "medium": return "default";
      case "low": return "secondary";
      default: return "default";
    }
  };

  const getInsightIcon = (type: string) => {
    switch (type) {
      case "reorder_alert": return AlertTriangle;
      case "overstock_warning": return Package;
      case "trend_analysis": return TrendingUp;
      case "optimization": return Zap;
      default: return Brain;
    }
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return "bg-green-500";
    if (confidence >= 0.6) return "bg-yellow-500";
    return "bg-red-500";
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Brain className="w-8 h-8 text-blue-600" />
            AI Inventory Insights
          </h1>
          <p className="text-muted-foreground mt-2">
            Intelligent analysis and recommendations for your inventory management
          </p>
        </div>
        <Button onClick={refreshAllData} className="flex items-center gap-2">
          <RefreshCw className="w-4 h-4" />
          Refresh Analysis
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="insights">Smart Insights</TabsTrigger>
          <TabsTrigger value="forecasts">Demand Forecast</TabsTrigger>
          <TabsTrigger value="optimization">Stock Optimization</TabsTrigger>
          <TabsTrigger value="recommendations">Reorder Alerts</TabsTrigger>
        </TabsList>

        <TabsContent value="insights" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Brain className="w-5 h-5" />
                Inventory Intelligence
              </CardTitle>
            </CardHeader>
            <CardContent>
              {insightsLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="animate-pulse bg-gray-200 h-20 rounded-md"></div>
                  ))}
                </div>
              ) : insights && insights.length > 0 ? (
                <div className="space-y-4">
                  {insights.map((insight: InventoryInsight, index: number) => {
                    const IconComponent = getInsightIcon(insight.type);
                    return (
                      <div key={index} className="border rounded-lg p-4 space-y-2">
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-2">
                            <IconComponent className="w-5 h-5 text-blue-600" />
                            <h3 className="font-semibold">{insight.title}</h3>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant={getPriorityColor(insight.priority)}>
                              {insight.priority}
                            </Badge>
                            {insight.actionRequired && (
                              <Badge variant="outline">Action Required</Badge>
                            )}
                          </div>
                        </div>
                        <p className="text-muted-foreground">{insight.description}</p>
                        {insight.products && insight.products.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {insight.products.map((product, i) => (
                              <Badge key={i} variant="secondary" className="text-xs">
                                {product}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Brain className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                  <p className="text-muted-foreground">No insights available. Add some products and stock movements to get AI analysis.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="forecasts" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5" />
                Demand Forecasting
              </CardTitle>
            </CardHeader>
            <CardContent>
              {forecastsLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="animate-pulse bg-gray-200 h-24 rounded-md"></div>
                  ))}
                </div>
              ) : forecasts && forecasts.length > 0 ? (
                <div className="grid gap-4 md:grid-cols-2">
                  {forecasts.map((forecast: DemandForecast) => (
                    <Card key={forecast.productId}>
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between mb-3">
                          <h3 className="font-semibold">{forecast.productName}</h3>
                          <Badge variant="outline">
                            {Math.round(forecast.confidence * 100)}% confidence
                          </Badge>
                        </div>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Current Stock:</span>
                            <span className="font-medium">{forecast.currentStock}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Predicted Daily Demand:</span>
                            <span className="font-medium">{forecast.predictedDemand}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Days Until Stockout:</span>
                            <span className={`font-medium ${forecast.daysUntilStockout <= 7 ? 'text-red-600' : forecast.daysUntilStockout <= 14 ? 'text-yellow-600' : 'text-green-600'}`}>
                              {forecast.daysUntilStockout} days
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Recommended Reorder:</span>
                            <span className="font-medium">{forecast.recommendedReorderQuantity}</span>
                          </div>
                        </div>
                        <div className="mt-3">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs text-muted-foreground">Confidence</span>
                            <Progress value={forecast.confidence * 100} className="flex-1" />
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground mt-2">{forecast.reasoning}</p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <TrendingUp className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                  <p className="text-muted-foreground">No forecast data available. Add products and stock movements to generate predictions.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="optimization" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="w-5 h-5" />
                Stock Level Optimization
              </CardTitle>
            </CardHeader>
            <CardContent>
              {optimizationsLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="animate-pulse bg-gray-200 h-20 rounded-md"></div>
                  ))}
                </div>
              ) : optimizations && optimizations.length > 0 ? (
                <div className="space-y-4">
                  {optimizations.map((opt: StockOptimization) => (
                    <div key={opt.productId} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="font-semibold">{opt.productName}</h3>
                        <Badge variant={opt.adjustment > 0 ? "default" : opt.adjustment < 0 ? "destructive" : "secondary"}>
                          {opt.adjustment > 0 ? `+${opt.adjustment}` : opt.adjustment < 0 ? opt.adjustment : "Optimal"}
                        </Badge>
                      </div>
                      <div className="grid grid-cols-3 gap-4 text-sm mb-3">
                        <div>
                          <span className="text-muted-foreground block">Current</span>
                          <span className="font-medium">{opt.currentStock}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground block">Optimal</span>
                          <span className="font-medium">{opt.optimalStock}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground block">Adjustment</span>
                          <span className={`font-medium ${opt.adjustment > 0 ? 'text-blue-600' : opt.adjustment < 0 ? 'text-red-600' : 'text-green-600'}`}>
                            {opt.adjustment > 0 ? `+${opt.adjustment}` : opt.adjustment}
                          </span>
                        </div>
                      </div>
                      <p className="text-sm text-muted-foreground mb-2">{opt.reasoning}</p>
                      <p className="text-xs text-blue-600">{opt.costImpact}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Zap className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                  <p className="text-muted-foreground">No optimization data available. Add products to analyze stock levels.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="recommendations" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5" />
                Urgent Reorder Recommendations
              </CardTitle>
            </CardHeader>
            <CardContent>
              {recommendationsLoading ? (
                <div className="space-y-3">
                  {[1, 2].map((i) => (
                    <div key={i} className="animate-pulse bg-gray-200 h-24 rounded-md"></div>
                  ))}
                </div>
              ) : recommendations && recommendations.length > 0 ? (
                <div className="space-y-4">
                  {recommendations.map((rec: DemandForecast) => (
                    <div key={rec.productId} className="border border-red-200 bg-red-50 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="font-semibold text-red-900">{rec.productName}</h3>
                        <Badge variant="destructive">
                          {rec.daysUntilStockout <= 0 ? "Out of Stock" : `${rec.daysUntilStockout} days left`}
                        </Badge>
                      </div>
                      <div className="grid grid-cols-2 gap-4 text-sm mb-3">
                        <div>
                          <span className="text-red-700 block">Current Stock</span>
                          <span className="font-medium text-red-900">{rec.currentStock}</span>
                        </div>
                        <div>
                          <span className="text-red-700 block">Recommended Order</span>
                          <span className="font-medium text-red-900">{rec.recommendedReorderQuantity}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-xs text-red-700">Confidence</span>
                        <div className="flex-1 bg-red-200 rounded-full h-2">
                          <div 
                            className="bg-red-600 h-2 rounded-full" 
                            style={{ width: `${rec.confidence * 100}%` }}
                          ></div>
                        </div>
                        <span className="text-xs text-red-700">{Math.round(rec.confidence * 100)}%</span>
                      </div>
                      <p className="text-sm text-red-800">{rec.reasoning}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <AlertTriangle className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                  <p className="text-muted-foreground">No urgent reorders needed. All stock levels appear healthy.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}