import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Mail, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  Send,
  RefreshCw,
  FileText,
  Loader2,
  Bell,
  Package
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface EmailAlert {
  id: string;
  type: "critical_stock" | "out_of_stock" | "reorder_reminder" | "daily_digest";
  subject: string;
  body: string;
  recipients: string[];
  priority: "high" | "medium" | "low";
  productIds?: number[];
  createdAt: string;
  sentAt?: string;
  status: "pending" | "sent" | "failed";
}

export function EmailAlerts() {
  const { toast } = useToast();
  const [expandedAlert, setExpandedAlert] = useState<string | null>(null);

  const { data: alerts, isLoading, refetch } = useQuery<EmailAlert[]>({
    queryKey: ["/api/alerts"],
    retry: false,
  });

  const generateAlertsMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("GET", "/api/alerts/generate");
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/alerts"] });
      toast({
        title: "Alerts Generated",
        description: `${data.length} new alerts have been created.`,
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to generate alerts.",
        variant: "destructive",
      });
    }
  });

  const generateDigestMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("GET", "/api/alerts/digest");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/alerts"] });
      toast({
        title: "Digest Created",
        description: "Daily digest has been generated.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to generate digest.",
        variant: "destructive",
      });
    }
  });

  const markSentMutation = useMutation({
    mutationFn: async (alertId: string) => {
      const response = await apiRequest("POST", `/api/alerts/${alertId}/send`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/alerts"] });
      toast({
        title: "Alert Marked as Sent",
        description: "The alert has been marked as sent.",
      });
    }
  });

  const getAlertTypeIcon = (type: string) => {
    switch (type) {
      case "out_of_stock": return AlertTriangle;
      case "critical_stock": return Package;
      case "reorder_reminder": return Bell;
      case "daily_digest": return FileText;
      default: return Mail;
    }
  };

  const getAlertTypeColor = (type: string) => {
    switch (type) {
      case "out_of_stock": return "bg-red-500";
      case "critical_stock": return "bg-orange-500";
      case "reorder_reminder": return "bg-amber-500";
      case "daily_digest": return "bg-blue-500";
      default: return "bg-gray-500";
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "high": return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300";
      case "medium": return "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300";
      case "low": return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "sent": return <CheckCircle2 className="w-4 h-4 text-green-500" />;
      case "pending": return <Clock className="w-4 h-4 text-amber-500" />;
      default: return <AlertTriangle className="w-4 h-4 text-red-500" />;
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('en-IN', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const pendingCount = alerts?.filter(a => a.status === "pending").length || 0;
  const highPriorityCount = alerts?.filter(a => a.priority === "high" && a.status === "pending").length || 0;

  return (
    <Card className="border-0 shadow-lg overflow-hidden">
      <CardHeader className="bg-gradient-to-r from-violet-50 to-purple-50 dark:from-gray-800 dark:to-gray-900 border-b">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 flex items-center justify-center relative">
              <Mail className="w-5 h-5 text-white" />
              {pendingCount > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                  {pendingCount}
                </span>
              )}
            </div>
            <div>
              <CardTitle className="text-lg">Email Alert Center</CardTitle>
              <p className="text-sm text-gray-500">AI-generated notifications and digests</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {highPriorityCount > 0 && (
              <Badge variant="destructive">{highPriorityCount} Urgent</Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-6">
        {/* Action Buttons */}
        <div className="flex gap-3 mb-6">
          <Button
            onClick={() => generateAlertsMutation.mutate()}
            disabled={generateAlertsMutation.isPending}
            className="bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700"
            data-testid="generate-alerts-btn"
          >
            {generateAlertsMutation.isPending ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4 mr-2" />
            )}
            Generate Stock Alerts
          </Button>
          <Button
            variant="outline"
            onClick={() => generateDigestMutation.mutate()}
            disabled={generateDigestMutation.isPending}
            data-testid="generate-digest-btn"
          >
            {generateDigestMutation.isPending ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <FileText className="w-4 h-4 mr-2" />
            )}
            Create Daily Digest
          </Button>
        </div>

        {/* Alerts List */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
          </div>
        ) : alerts && alerts.length > 0 ? (
          <ScrollArea className="h-96">
            <div className="space-y-3">
              <AnimatePresence>
                {alerts.map((alert, index) => {
                  const IconComponent = getAlertTypeIcon(alert.type);
                  const isExpanded = expandedAlert === alert.id;
                  
                  return (
                    <motion.div
                      key={alert.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 20 }}
                      transition={{ delay: index * 0.05 }}
                      className="border rounded-xl overflow-hidden bg-white dark:bg-gray-800 hover:shadow-md transition-all"
                      data-testid={`alert-${alert.id}`}
                    >
                      <div 
                        className="p-4 cursor-pointer"
                        onClick={() => setExpandedAlert(isExpanded ? null : alert.id)}
                      >
                        <div className="flex items-start gap-3">
                          <div className={`w-10 h-10 rounded-lg ${getAlertTypeColor(alert.type)} flex items-center justify-center flex-shrink-0`}>
                            <IconComponent className="w-5 h-5 text-white" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <h4 className="font-semibold text-gray-900 dark:text-white truncate flex-1">
                                {alert.subject}
                              </h4>
                              {getStatusIcon(alert.status)}
                            </div>
                            <div className="flex items-center gap-2 text-xs">
                              <Badge className={getPriorityColor(alert.priority)}>
                                {alert.priority}
                              </Badge>
                              <span className="text-gray-500">{formatDate(alert.createdAt)}</span>
                              {alert.productIds && (
                                <span className="text-gray-500">
                                  {alert.productIds.length} products
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      <AnimatePresence>
                        {isExpanded && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="border-t border-gray-200 dark:border-gray-700"
                          >
                            <div className="p-4 bg-gray-50 dark:bg-gray-900">
                              <pre className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap font-sans">
                                {alert.body}
                              </pre>
                              <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                                <div className="text-xs text-gray-500">
                                  Recipients: {alert.recipients.join(", ")}
                                </div>
                                {alert.status === "pending" && (
                                  <Button
                                    size="sm"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      markSentMutation.mutate(alert.id);
                                    }}
                                    disabled={markSentMutation.isPending}
                                    className="bg-green-600 hover:bg-green-700"
                                  >
                                    <Send className="w-3 h-3 mr-1" />
                                    Mark as Sent
                                  </Button>
                                )}
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          </ScrollArea>
        ) : (
          <div className="flex flex-col items-center justify-center py-12">
            <div className="w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-4">
              <Mail className="w-8 h-8 text-gray-400" />
            </div>
            <h4 className="font-semibold text-gray-900 dark:text-white mb-1">
              No Alerts Yet
            </h4>
            <p className="text-sm text-gray-500 text-center max-w-xs">
              Click "Generate Stock Alerts" to create notifications based on your current inventory status.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
