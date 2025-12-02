import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { 
  AlertTriangle, 
  AlertCircle, 
  Info, 
  Package, 
  ArrowRight,
  Loader2,
  Bell,
  CheckCircle
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";

interface AlertInsight {
  productId: number;
  productName: string;
  alertType: "critical_low" | "out_of_stock" | "overstock" | "expiring";
  severity: "critical" | "warning" | "info";
  message: string;
  aiRecommendation: string;
  actionRequired: boolean;
}

export function AlertInsights() {
  const { data: alerts, isLoading, refetch } = useQuery<AlertInsight[]>({
    queryKey: ["/api/ai/alert-insights"],
    retry: false,
  });

  const getSeverityStyles = (severity: string) => {
    switch (severity) {
      case "critical":
        return {
          bg: "bg-red-50 dark:bg-red-900/20",
          border: "border-red-200 dark:border-red-800",
          icon: AlertTriangle,
          iconColor: "text-red-600",
          badge: "bg-red-500 text-white"
        };
      case "warning":
        return {
          bg: "bg-amber-50 dark:bg-amber-900/20",
          border: "border-amber-200 dark:border-amber-800",
          icon: AlertCircle,
          iconColor: "text-amber-600",
          badge: "bg-amber-500 text-white"
        };
      default:
        return {
          bg: "bg-blue-50 dark:bg-blue-900/20",
          border: "border-blue-200 dark:border-blue-800",
          icon: Info,
          iconColor: "text-blue-600",
          badge: "bg-blue-500 text-white"
        };
    }
  };

  const getAlertTypeLabel = (type: string) => {
    switch (type) {
      case "critical_low": return "Critical Low";
      case "out_of_stock": return "Out of Stock";
      case "overstock": return "Overstock";
      case "expiring": return "Expiring Soon";
      default: return type;
    }
  };

  if (isLoading) {
    return (
      <Card className="border-0 shadow-lg">
        <CardContent className="flex items-center justify-center h-64">
          <div className="text-center">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-3" />
            <p className="text-gray-500">Generating AI-powered alerts...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const criticalCount = alerts?.filter(a => a.severity === "critical").length || 0;
  const warningCount = alerts?.filter(a => a.severity === "warning").length || 0;

  return (
    <Card className="border-0 shadow-lg overflow-hidden">
      <CardHeader className="bg-gradient-to-r from-rose-50 to-pink-50 dark:from-gray-800 dark:to-gray-900 border-b">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-r from-rose-600 to-pink-600 flex items-center justify-center relative">
              <Bell className="w-5 h-5 text-white" />
              {criticalCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                  {criticalCount}
                </span>
              )}
            </div>
            <div>
              <CardTitle className="text-lg">Smart Alerts</CardTitle>
              <p className="text-sm text-gray-500">AI-generated inventory recommendations</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {criticalCount > 0 && (
              <Badge variant="destructive">{criticalCount} Critical</Badge>
            )}
            {warningCount > 0 && (
              <Badge className="bg-amber-500 text-white">{warningCount} Warnings</Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {alerts && alerts.length > 0 ? (
          <ScrollArea className="h-96">
            <div className="p-4 space-y-3">
              {alerts.map((alert, index) => {
                const styles = getSeverityStyles(alert.severity);
                const IconComponent = styles.icon;
                
                return (
                  <motion.div
                    key={`${alert.productId}-${index}`}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className={`p-4 rounded-xl border ${styles.bg} ${styles.border}`}
                    data-testid={`alert-${alert.productId}`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`w-10 h-10 rounded-lg ${styles.bg} flex items-center justify-center flex-shrink-0`}>
                        <IconComponent className={`w-5 h-5 ${styles.iconColor}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-semibold text-gray-900 dark:text-white truncate">
                            {alert.productName}
                          </h4>
                          <Badge className={styles.badge}>
                            {getAlertTypeLabel(alert.alertType)}
                          </Badge>
                          {alert.actionRequired && (
                            <Badge variant="outline" className="text-xs">
                              Action Required
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-gray-600 dark:text-gray-300 mb-2">
                          {alert.message}
                        </p>
                        <div className="p-3 bg-white/50 dark:bg-gray-900/50 rounded-lg">
                          <div className="flex items-start gap-2">
                            <div className="w-6 h-6 rounded-full bg-gradient-to-r from-purple-500 to-indigo-500 flex items-center justify-center flex-shrink-0">
                              <Package className="w-3 h-3 text-white" />
                            </div>
                            <div>
                              <p className="text-xs text-gray-500 mb-0.5">AI Recommendation</p>
                              <p className="text-sm text-gray-700 dark:text-gray-300">
                                {alert.aiRecommendation}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </ScrollArea>
        ) : (
          <div className="flex flex-col items-center justify-center h-64">
            <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/20 flex items-center justify-center mb-4">
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
            <h4 className="font-semibold text-gray-900 dark:text-white mb-1">
              All Clear!
            </h4>
            <p className="text-sm text-gray-500 text-center max-w-xs">
              No alerts at this time. Your inventory is in good shape.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
