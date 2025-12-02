import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Truck, 
  Star, 
  Clock, 
  DollarSign, 
  CheckCircle2, 
  Loader2,
  Building2,
  ArrowRight
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { apiRequest } from "@/lib/queryClient";

interface VendorRecommendation {
  vendorName: string;
  score: number;
  priceRating: number;
  deliveryRating: number;
  qualityRating: number;
  reasoning: string;
  estimatedCost: string;
  deliveryTime: string;
}

export function VendorRecommendations() {
  const [productName, setProductName] = useState("");
  const [quantity, setQuantity] = useState("");
  const [recommendations, setRecommendations] = useState<VendorRecommendation[]>([]);

  const vendorMutation = useMutation({
    mutationFn: async ({ productName, quantity }: { productName: string; quantity: number }) => {
      const response = await apiRequest("POST", "/api/ai/vendor-recommendations", { productName, quantity });
      return response.json();
    },
    onSuccess: (data) => {
      setRecommendations(data);
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!productName.trim() || !quantity || vendorMutation.isPending) return;
    vendorMutation.mutate({ productName, quantity: parseInt(quantity) });
  };

  const renderStars = (rating: number) => {
    return (
      <div className="flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`w-3.5 h-3.5 ${
              star <= rating 
                ? "fill-yellow-400 text-yellow-400" 
                : "fill-gray-200 text-gray-200"
            }`}
          />
        ))}
      </div>
    );
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return "from-green-500 to-emerald-500";
    if (score >= 60) return "from-blue-500 to-indigo-500";
    if (score >= 40) return "from-yellow-500 to-orange-500";
    return "from-red-500 to-pink-500";
  };

  return (
    <Card className="border-0 shadow-lg overflow-hidden">
      <CardHeader className="bg-gradient-to-r from-teal-50 to-cyan-50 dark:from-gray-800 dark:to-gray-900 border-b">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-r from-teal-600 to-cyan-600 flex items-center justify-center">
            <Truck className="w-5 h-5 text-white" />
          </div>
          <div>
            <CardTitle className="text-lg">Smart Vendor Finder</CardTitle>
            <p className="text-sm text-gray-500">AI-powered supplier recommendations</p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-6">
        <form onSubmit={handleSubmit} className="flex gap-3 mb-6">
          <Input
            value={productName}
            onChange={(e) => setProductName(e.target.value)}
            placeholder="Product name (e.g., Carbide Tools)"
            className="flex-1"
            data-testid="vendor-product-input"
          />
          <Input
            type="number"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            placeholder="Quantity"
            className="w-28"
            min="1"
            data-testid="vendor-quantity-input"
          />
          <Button 
            type="submit" 
            disabled={vendorMutation.isPending}
            className="bg-gradient-to-r from-teal-600 to-cyan-600 hover:from-teal-700 hover:to-cyan-700"
            data-testid="find-vendors-btn"
          >
            {vendorMutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                Find Vendors
                <ArrowRight className="w-4 h-4 ml-1" />
              </>
            )}
          </Button>
        </form>

        <AnimatePresence>
          {recommendations.length > 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-4"
            >
              {recommendations.map((vendor, index) => (
                <motion.div
                  key={vendor.vendorName}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="relative overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700 hover:border-teal-300 dark:hover:border-teal-600 transition-all"
                  data-testid={`vendor-card-${index}`}
                >
                  {/* Score badge */}
                  <div className={`absolute top-0 right-0 px-4 py-1 rounded-bl-xl bg-gradient-to-r ${getScoreColor(vendor.score)} text-white font-bold text-sm`}>
                    {vendor.score}/100
                  </div>

                  <div className="p-4">
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 rounded-xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center flex-shrink-0">
                        <Building2 className="w-6 h-6 text-gray-600 dark:text-gray-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <h4 className="font-semibold text-gray-900 dark:text-white">
                            {vendor.vendorName}
                          </h4>
                          {index === 0 && (
                            <Badge className="bg-gradient-to-r from-green-500 to-emerald-500 text-white">
                              <CheckCircle2 className="w-3 h-3 mr-1" />
                              Best Match
                            </Badge>
                          )}
                        </div>

                        <div className="grid grid-cols-3 gap-4 mb-3">
                          <div>
                            <div className="flex items-center gap-1 text-xs text-gray-500 mb-1">
                              <DollarSign className="w-3 h-3" />
                              Price
                            </div>
                            {renderStars(vendor.priceRating)}
                          </div>
                          <div>
                            <div className="flex items-center gap-1 text-xs text-gray-500 mb-1">
                              <Clock className="w-3 h-3" />
                              Delivery
                            </div>
                            {renderStars(vendor.deliveryRating)}
                          </div>
                          <div>
                            <div className="flex items-center gap-1 text-xs text-gray-500 mb-1">
                              <Star className="w-3 h-3" />
                              Quality
                            </div>
                            {renderStars(vendor.qualityRating)}
                          </div>
                        </div>

                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                          {vendor.reasoning}
                        </p>

                        <div className="flex items-center gap-4 text-sm">
                          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400">
                            <DollarSign className="w-3.5 h-3.5" />
                            {vendor.estimatedCost}
                          </div>
                          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400">
                            <Clock className="w-3.5 h-3.5" />
                            {vendor.deliveryTime}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Overall score bar */}
                    <div className="mt-4 pt-3 border-t border-gray-100 dark:border-gray-800">
                      <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                        <span>Overall Score</span>
                        <span className="font-medium">{vendor.score}%</span>
                      </div>
                      <Progress value={vendor.score} className="h-2" />
                    </div>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {vendorMutation.isPending && (
          <div className="flex flex-col items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-teal-600 mb-3" />
            <p className="text-gray-500">Analyzing suppliers and market data...</p>
          </div>
        )}

        {!vendorMutation.isPending && recommendations.length === 0 && (
          <div className="text-center py-8">
            <Truck className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">Enter a product name and quantity to get vendor recommendations</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
