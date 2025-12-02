import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TrendingUp, TrendingDown, Minus, Activity, Calendar, AlertTriangle, Loader2 } from "lucide-react";

interface PredictiveAnalytics {
  productId: number;
  productName: string;
  historicalData: Array<{ date: string; quantity: number }>;
  forecast: Array<{ date: string; predictedQuantity: number; confidence: number }>;
  seasonalityPattern: string;
  trend: "increasing" | "decreasing" | "stable";
  anomalies: string[];
}

export function PredictiveChart() {
  const [selectedProduct, setSelectedProduct] = useState<number | null>(null);

  const { data: analytics, isLoading } = useQuery<PredictiveAnalytics[]>({
    queryKey: ["/api/ai/predictive-analytics"],
    retry: false,
  });

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case "increasing": return <TrendingUp className="w-4 h-4 text-green-500" />;
      case "decreasing": return <TrendingDown className="w-4 h-4 text-red-500" />;
      default: return <Minus className="w-4 h-4 text-gray-500" />;
    }
  };

  const getTrendColor = (trend: string) => {
    switch (trend) {
      case "increasing": return "text-green-600 bg-green-50";
      case "decreasing": return "text-red-600 bg-red-50";
      default: return "text-gray-600 bg-gray-50";
    }
  };

  const prepareChartData = (product: PredictiveAnalytics) => {
    const historical = product.historicalData.map(d => ({
      date: new Date(d.date).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' }),
      actual: d.quantity,
      predicted: null,
      confidence: null
    }));

    const forecast = product.forecast.map(d => ({
      date: new Date(d.date).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' }),
      actual: null,
      predicted: d.predictedQuantity,
      confidence: d.confidence * 100
    }));

    return [...historical, ...forecast];
  };

  if (isLoading) {
    return (
      <Card className="border-0 shadow-lg">
        <CardContent className="flex items-center justify-center h-96">
          <div className="text-center">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-3" />
            <p className="text-gray-500">Generating predictive analytics...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!analytics || analytics.length === 0) {
    return (
      <Card className="border-0 shadow-lg">
        <CardContent className="flex items-center justify-center h-96">
          <div className="text-center">
            <Activity className="w-12 h-12 text-gray-400 mx-auto mb-3" />
            <p className="text-gray-500">No predictive data available yet.</p>
            <p className="text-sm text-gray-400">Add more stock movements to generate forecasts.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const selectedData = selectedProduct 
    ? analytics.find(a => a.productId === selectedProduct)
    : analytics[0];

  return (
    <Card className="border-0 shadow-lg overflow-hidden">
      <CardHeader className="bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-gray-800 dark:to-gray-900 border-b">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 flex items-center justify-center">
              <Activity className="w-5 h-5 text-white" />
            </div>
            <div>
              <CardTitle className="text-lg">Demand Forecasting</CardTitle>
              <p className="text-sm text-gray-500">AI-powered 7-day predictions</p>
            </div>
          </div>
          <Badge variant="outline" className="bg-white dark:bg-gray-800">
            <Calendar className="w-3 h-3 mr-1" />
            Updated just now
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="p-6">
        <Tabs defaultValue="chart" className="space-y-4">
          <div className="flex items-center justify-between">
            <TabsList>
              <TabsTrigger value="chart">Chart View</TabsTrigger>
              <TabsTrigger value="products">By Product</TabsTrigger>
            </TabsList>
            {selectedData && (
              <div className="flex items-center gap-2">
                <Badge className={getTrendColor(selectedData.trend)}>
                  {getTrendIcon(selectedData.trend)}
                  <span className="ml-1 capitalize">{selectedData.trend}</span>
                </Badge>
                <Badge variant="outline">
                  {selectedData.seasonalityPattern} pattern
                </Badge>
              </div>
            )}
          </div>

          <TabsContent value="chart" className="space-y-4">
            {selectedData && (
              <>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={prepareChartData(selectedData)}>
                      <defs>
                        <linearGradient id="colorActual" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="colorPredicted" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#8B5CF6" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#8B5CF6" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                      <XAxis dataKey="date" tick={{ fontSize: 12 }} stroke="#9CA3AF" />
                      <YAxis tick={{ fontSize: 12 }} stroke="#9CA3AF" />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'white',
                          border: '1px solid #E5E7EB',
                          borderRadius: '8px',
                          boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)'
                        }}
                      />
                      <Legend />
                      <Area
                        type="monotone"
                        dataKey="actual"
                        name="Historical"
                        stroke="#3B82F6"
                        strokeWidth={2}
                        fill="url(#colorActual)"
                        dot={{ fill: '#3B82F6', strokeWidth: 2 }}
                      />
                      <Area
                        type="monotone"
                        dataKey="predicted"
                        name="Forecast"
                        stroke="#8B5CF6"
                        strokeWidth={2}
                        strokeDasharray="5 5"
                        fill="url(#colorPredicted)"
                        dot={{ fill: '#8B5CF6', strokeWidth: 2 }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>

                {selectedData.anomalies && selectedData.anomalies.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-xl border border-amber-200 dark:border-amber-800"
                  >
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <h4 className="font-medium text-amber-800 dark:text-amber-200 mb-1">
                          Anomalies Detected
                        </h4>
                        <ul className="space-y-1">
                          {selectedData.anomalies.map((anomaly, i) => (
                            <li key={i} className="text-sm text-amber-700 dark:text-amber-300">
                              {anomaly}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </motion.div>
                )}
              </>
            )}
          </TabsContent>

          <TabsContent value="products" className="space-y-3">
            <div className="grid gap-3 md:grid-cols-2">
              {analytics.map((product) => (
                <motion.div
                  key={product.productId}
                  whileHover={{ scale: 1.02 }}
                  className={`p-4 rounded-xl border cursor-pointer transition-all ${
                    selectedProduct === product.productId
                      ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                      : "border-gray-200 dark:border-gray-700 hover:border-blue-300"
                  }`}
                  onClick={() => setSelectedProduct(product.productId)}
                  data-testid={`product-forecast-${product.productId}`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-medium text-gray-900 dark:text-white truncate flex-1">
                      {product.productName}
                    </h4>
                    {getTrendIcon(product.trend)}
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Badge variant="outline" className="text-xs">
                      {product.seasonalityPattern}
                    </Badge>
                    {product.forecast.length > 0 && (
                      <span className="text-gray-500">
                        Next: {product.forecast[0]?.predictedQuantity || 0} units
                      </span>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
