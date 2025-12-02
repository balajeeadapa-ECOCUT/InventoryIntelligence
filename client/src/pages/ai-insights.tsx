import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Sidebar } from "@/components/layout/sidebar";
import { 
  Brain, 
  TrendingUp, 
  AlertTriangle, 
  Package, 
  Zap, 
  RefreshCw,
  Sparkles,
  MessageCircle,
  FileText,
  Truck,
  Activity,
  Bell
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { NaturalLanguageSearch } from "@/components/ai/natural-language-search";
import { PredictiveChart } from "@/components/ai/predictive-chart";
import { VendorRecommendations } from "@/components/ai/vendor-recommendations";
import { DocumentProcessor } from "@/components/ai/document-processor";
import { AlertInsights } from "@/components/ai/alert-insights";
import { EmailAlerts } from "@/components/ai/email-alerts";

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
  const [activeTab, setActiveTab] = useState("overview");

  const { data: insights, isLoading: insightsLoading, refetch: refetchInsights } = useQuery<InventoryInsight[]>({
    queryKey: ["/api/ai/inventory-insights"],
    retry: false,
  });

  const { data: forecasts, isLoading: forecastsLoading, refetch: refetchForecasts } = useQuery<DemandForecast[]>({
    queryKey: ["/api/ai/demand-forecast"],
    retry: false,
  });

  const { data: optimizations, isLoading: optimizationsLoading, refetch: refetchOptimizations } = useQuery<StockOptimization[]>({
    queryKey: ["/api/ai/stock-optimization"],
    retry: false,
  });

  const { data: recommendations, isLoading: recommendationsLoading, refetch: refetchRecommendations } = useQuery<DemandForecast[]>({
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

  const tabItems = [
    { value: "overview", label: "Overview", icon: Sparkles },
    { value: "analytics", label: "Predictive Analytics", icon: Activity },
    { value: "insights", label: "Smart Insights", icon: Brain },
    { value: "vendors", label: "Vendor Finder", icon: Truck },
    { value: "documents", label: "Document Scanner", icon: FileText },
    { value: "alerts", label: "Smart Alerts", icon: Bell },
    { value: "emails", label: "Email Alerts", icon: MessageCircle },
  ];

  return (
    <div className="flex h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-gray-900 dark:via-gray-900 dark:to-gray-800">
      <Sidebar />
      <main className="flex-1 overflow-auto p-6">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center justify-between"
          >
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/30">
                <Brain className="w-7 h-7 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-600 bg-clip-text text-transparent">
                  AI Command Center
                </h1>
                <p className="text-gray-500 dark:text-gray-400 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-purple-500" />
                  Powered by GPT-4o & Gemini Pro
                </p>
              </div>
            </div>
            <Button 
              onClick={refreshAllData} 
              className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 shadow-lg shadow-blue-500/25"
              data-testid="refresh-analysis-btn"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh Analysis
            </Button>
          </motion.div>

          {/* Natural Language Search */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <NaturalLanguageSearch />
          </motion.div>

          {/* Tab Navigation */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            <TabsList className="grid grid-cols-6 bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm p-1 rounded-xl shadow-lg">
              {tabItems.map((tab) => (
                <TabsTrigger
                  key={tab.value}
                  value={tab.value}
                  className="flex items-center gap-2 data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-600 data-[state=active]:to-purple-600 data-[state=active]:text-white rounded-lg transition-all"
                  data-testid={`tab-${tab.value}`}
                >
                  <tab.icon className="w-4 h-4" />
                  <span className="hidden lg:inline">{tab.label}</span>
                </TabsTrigger>
              ))}
            </TabsList>

            {/* Overview Tab */}
            <TabsContent value="overview" className="space-y-6">
              <div className="grid gap-6 lg:grid-cols-2">
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.2 }}
                >
                  <PredictiveChart />
                </motion.div>
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.3 }}
                >
                  <AlertInsights />
                </motion.div>
              </div>

              {/* Smart Insights Grid */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
              >
                <Card className="border-0 shadow-lg overflow-hidden">
                  <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-gray-800 dark:to-gray-900 border-b">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 flex items-center justify-center">
                        <Brain className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <CardTitle className="text-lg">AI-Generated Insights</CardTitle>
                        <p className="text-sm text-gray-500">Real-time inventory intelligence</p>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="p-6">
                    {insightsLoading ? (
                      <div className="space-y-3">
                        {[1, 2, 3].map((i) => (
                          <div key={i} className="animate-pulse bg-gray-200 dark:bg-gray-700 h-20 rounded-xl"></div>
                        ))}
                      </div>
                    ) : insights && insights.length > 0 ? (
                      <div className="grid gap-4 md:grid-cols-2">
                        {insights.map((insight, index) => {
                          const IconComponent = getInsightIcon(insight.type);
                          return (
                            <motion.div 
                              key={index} 
                              initial={{ opacity: 0, scale: 0.95 }}
                              animate={{ opacity: 1, scale: 1 }}
                              transition={{ delay: index * 0.1 }}
                              className="border rounded-xl p-4 space-y-2 hover:shadow-md transition-all bg-white dark:bg-gray-800"
                              data-testid={`insight-${index}`}
                            >
                              <div className="flex items-start justify-between">
                                <div className="flex items-center gap-2">
                                  <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                                    <IconComponent className="w-4 h-4 text-blue-600" />
                                  </div>
                                  <h3 className="font-semibold text-gray-900 dark:text-white">{insight.title}</h3>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Badge variant={getPriorityColor(insight.priority) as any}>
                                    {insight.priority}
                                  </Badge>
                                </div>
                              </div>
                              <p className="text-sm text-gray-600 dark:text-gray-400">{insight.description}</p>
                              {insight.products && insight.products.length > 0 && (
                                <div className="flex flex-wrap gap-1 mt-2">
                                  {insight.products.slice(0, 3).map((product, i) => (
                                    <Badge key={i} variant="secondary" className="text-xs">
                                      {product}
                                    </Badge>
                                  ))}
                                  {insight.products.length > 3 && (
                                    <Badge variant="outline" className="text-xs">
                                      +{insight.products.length - 3} more
                                    </Badge>
                                  )}
                                </div>
                              )}
                            </motion.div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="text-center py-12">
                        <Brain className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
                        <p className="text-gray-500 dark:text-gray-400">No insights available. Add products and stock movements to generate AI analysis.</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            </TabsContent>

            {/* Predictive Analytics Tab */}
            <TabsContent value="analytics" className="space-y-6">
              <PredictiveChart />
              
              {/* Demand Forecasts */}
              <Card className="border-0 shadow-lg">
                <CardHeader className="bg-gradient-to-r from-purple-50 to-pink-50 dark:from-gray-800 dark:to-gray-900 border-b">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 flex items-center justify-center">
                      <TrendingUp className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">Demand Forecasting</CardTitle>
                      <p className="text-sm text-gray-500">AI-powered product demand predictions</p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-6">
                  {forecastsLoading ? (
                    <div className="grid gap-4 md:grid-cols-2">
                      {[1, 2, 3, 4].map((i) => (
                        <div key={i} className="animate-pulse bg-gray-200 dark:bg-gray-700 h-40 rounded-xl"></div>
                      ))}
                    </div>
                  ) : forecasts && forecasts.length > 0 ? (
                    <div className="grid gap-4 md:grid-cols-2">
                      {forecasts.map((forecast) => (
                        <motion.div
                          key={forecast.productId}
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="p-4 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 hover:shadow-lg transition-all"
                          data-testid={`forecast-${forecast.productId}`}
                        >
                          <div className="flex items-center justify-between mb-3">
                            <h3 className="font-semibold text-gray-900 dark:text-white truncate">{forecast.productName}</h3>
                            <Badge variant="outline" className="bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300">
                              {Math.round(forecast.confidence * 100)}% confidence
                            </Badge>
                          </div>
                          <div className="grid grid-cols-2 gap-3 text-sm mb-3">
                            <div className="p-2 bg-gray-50 dark:bg-gray-900 rounded-lg">
                              <span className="text-gray-500 block text-xs">Current Stock</span>
                              <span className="font-medium text-gray-900 dark:text-white">{forecast.currentStock}</span>
                            </div>
                            <div className="p-2 bg-gray-50 dark:bg-gray-900 rounded-lg">
                              <span className="text-gray-500 block text-xs">Daily Demand</span>
                              <span className="font-medium text-gray-900 dark:text-white">{forecast.predictedDemand}</span>
                            </div>
                            <div className={`p-2 rounded-lg ${
                              forecast.daysUntilStockout <= 7 
                                ? 'bg-red-50 dark:bg-red-900/20' 
                                : forecast.daysUntilStockout <= 14 
                                ? 'bg-amber-50 dark:bg-amber-900/20' 
                                : 'bg-green-50 dark:bg-green-900/20'
                            }`}>
                              <span className="text-gray-500 block text-xs">Days to Stockout</span>
                              <span className={`font-medium ${
                                forecast.daysUntilStockout <= 7 ? 'text-red-600' : forecast.daysUntilStockout <= 14 ? 'text-amber-600' : 'text-green-600'
                              }`}>
                                {forecast.daysUntilStockout} days
                              </span>
                            </div>
                            <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                              <span className="text-gray-500 block text-xs">Reorder Qty</span>
                              <span className="font-medium text-blue-600">{forecast.recommendedReorderQuantity}</span>
                            </div>
                          </div>
                          <div className="mt-2">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-xs text-gray-500">Confidence</span>
                              <Progress value={forecast.confidence * 100} className="flex-1 h-2" />
                            </div>
                          </div>
                          <p className="text-xs text-gray-500 mt-2 line-clamp-2">{forecast.reasoning}</p>
                        </motion.div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-12">
                      <TrendingUp className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
                      <p className="text-gray-500 dark:text-gray-400">No forecast data available. Add products and stock movements to generate predictions.</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Smart Insights Tab */}
            <TabsContent value="insights" className="space-y-6">
              <div className="grid gap-6 lg:grid-cols-2">
                {/* Stock Optimization */}
                <Card className="border-0 shadow-lg">
                  <CardHeader className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-gray-800 dark:to-gray-900 border-b">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-r from-green-600 to-emerald-600 flex items-center justify-center">
                        <Zap className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <CardTitle className="text-lg">Stock Optimization</CardTitle>
                        <p className="text-sm text-gray-500">AI-recommended stock levels</p>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="p-4">
                    {optimizationsLoading ? (
                      <div className="space-y-3">
                        {[1, 2, 3].map((i) => (
                          <div key={i} className="animate-pulse bg-gray-200 dark:bg-gray-700 h-16 rounded-xl"></div>
                        ))}
                      </div>
                    ) : optimizations && optimizations.length > 0 ? (
                      <div className="space-y-3">
                        {optimizations.map((opt) => (
                          <motion.div 
                            key={opt.productId} 
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            className="p-3 border rounded-xl bg-white dark:bg-gray-800 hover:shadow-md transition-all"
                            data-testid={`optimization-${opt.productId}`}
                          >
                            <div className="flex items-center justify-between mb-2">
                              <h3 className="font-medium text-gray-900 dark:text-white truncate">{opt.productName}</h3>
                              <Badge variant={opt.adjustment > 0 ? "default" : opt.adjustment < 0 ? "destructive" : "secondary"}>
                                {opt.adjustment > 0 ? `+${opt.adjustment}` : opt.adjustment < 0 ? opt.adjustment : "Optimal"}
                              </Badge>
                            </div>
                            <div className="grid grid-cols-3 gap-2 text-xs mb-2">
                              <div>
                                <span className="text-gray-500">Current</span>
                                <span className="block font-medium text-gray-900 dark:text-white">{opt.currentStock}</span>
                              </div>
                              <div>
                                <span className="text-gray-500">Optimal</span>
                                <span className="block font-medium text-green-600">{opt.optimalStock}</span>
                              </div>
                              <div>
                                <span className="text-gray-500">Impact</span>
                                <span className="block font-medium text-blue-600 truncate">{opt.costImpact}</span>
                              </div>
                            </div>
                          </motion.div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8">
                        <Zap className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                        <p className="text-sm text-gray-500 dark:text-gray-400">No optimization data available.</p>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Reorder Recommendations */}
                <Card className="border-0 shadow-lg">
                  <CardHeader className="bg-gradient-to-r from-red-50 to-orange-50 dark:from-gray-800 dark:to-gray-900 border-b">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-r from-red-600 to-orange-600 flex items-center justify-center">
                        <AlertTriangle className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <CardTitle className="text-lg">Urgent Reorders</CardTitle>
                        <p className="text-sm text-gray-500">Products requiring immediate attention</p>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="p-4">
                    {recommendationsLoading ? (
                      <div className="space-y-3">
                        {[1, 2].map((i) => (
                          <div key={i} className="animate-pulse bg-gray-200 dark:bg-gray-700 h-20 rounded-xl"></div>
                        ))}
                      </div>
                    ) : recommendations && recommendations.length > 0 ? (
                      <div className="space-y-3">
                        {recommendations.map((rec) => (
                          <motion.div 
                            key={rec.productId} 
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            className="p-3 border border-red-200 bg-red-50 dark:bg-red-900/20 dark:border-red-800 rounded-xl"
                            data-testid={`reorder-${rec.productId}`}
                          >
                            <div className="flex items-center justify-between mb-2">
                              <h3 className="font-medium text-red-900 dark:text-red-200 truncate">{rec.productName}</h3>
                              <Badge variant="destructive">
                                {rec.daysUntilStockout <= 0 ? "Out of Stock" : `${rec.daysUntilStockout}d left`}
                              </Badge>
                            </div>
                            <div className="grid grid-cols-2 gap-2 text-xs">
                              <div>
                                <span className="text-red-700 dark:text-red-300">Current Stock</span>
                                <span className="block font-medium text-red-900 dark:text-red-100">{rec.currentStock}</span>
                              </div>
                              <div>
                                <span className="text-red-700 dark:text-red-300">Order Qty</span>
                                <span className="block font-medium text-red-900 dark:text-red-100">{rec.recommendedReorderQuantity}</span>
                              </div>
                            </div>
                          </motion.div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8">
                        <AlertTriangle className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                        <p className="text-sm text-gray-500 dark:text-gray-400">No urgent reorders needed.</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* Vendor Finder Tab */}
            <TabsContent value="vendors">
              <VendorRecommendations />
            </TabsContent>

            {/* Document Scanner Tab */}
            <TabsContent value="documents">
              <DocumentProcessor />
            </TabsContent>

            {/* Smart Alerts Tab */}
            <TabsContent value="alerts">
              <AlertInsights />
            </TabsContent>
            
            <TabsContent value="emails">
              <EmailAlerts />
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
}
