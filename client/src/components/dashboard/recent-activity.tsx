import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Minus, Edit, FileText } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { formatDistanceToNow, format } from "date-fns";
import { Badge } from "@/components/ui/badge";

export function RecentActivity() {
  const { data: movements, isLoading } = useQuery<any[]>({
    queryKey: ["/api/stock-movements"],
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  const getIcon = (type: string) => {
    switch (type) {
      case "IN":
        return { icon: Plus, color: "text-green-600", bg: "bg-green-50" };
      case "OUT":
        return { icon: Minus, color: "text-red-600", bg: "bg-red-50" };
      default:
        return { icon: Edit, color: "text-yellow-600", bg: "bg-yellow-50" };
    }
  };

  const getActionText = (type: string, quantity: number) => {
    switch (type) {
      case "IN":
        return `Added ${quantity} units`;
      case "OUT":
        return `Removed ${quantity} units`;
      default:
        return `Adjusted stock`;
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Recent Stock Movements</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="flex items-center space-x-4 p-3 rounded-lg bg-gray-50 animate-pulse">
                <div className="w-10 h-10 bg-gray-200 rounded-lg"></div>
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-gray-200 rounded w-32"></div>
                  <div className="h-3 bg-gray-200 rounded w-24"></div>
                </div>
                <div className="h-4 bg-gray-200 rounded w-8"></div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Recent Stock Movements</CardTitle>
          <Button variant="ghost" size="sm">
            View All
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {movements?.slice(0, 3).map((movement: any) => {
            const iconConfig = getIcon(movement.type);
            return (
              <div key={movement.id} className="flex items-center space-x-4 p-3 rounded-lg bg-gray-50" data-testid={`movement-${movement.id}`}>
                <div className={`w-10 h-10 ${iconConfig.bg} rounded-lg flex items-center justify-center`}>
                  <iconConfig.icon className={`h-4 w-4 ${iconConfig.color}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900">{movement.product.name}</p>
                  <p className="text-sm text-gray-600">
                    {getActionText(movement.type, movement.quantity)} • {" "}
                    {formatDistanceToNow(new Date(movement.createdAt), { addSuffix: true })}
                  </p>
                  {movement.invoiceNumber && (
                    <div className="flex items-center gap-1.5 mt-1">
                      <Badge variant="outline" className="text-xs font-normal flex items-center gap-1">
                        <FileText className="h-3 w-3" />
                        {movement.invoiceNumber}
                        {movement.invoiceDate && (
                          <span className="text-muted-foreground">
                            • {format(new Date(movement.invoiceDate), "dd/MM/yy")}
                          </span>
                        )}
                      </Badge>
                    </div>
                  )}
                </div>
                <span className={`font-medium ${iconConfig.color}`}>
                  {movement.type === "IN" ? "+" : movement.type === "OUT" ? "-" : "±"}{movement.quantity}
                </span>
              </div>
            );
          })}
          
          {!movements?.length && (
            <div className="text-center py-8 text-gray-500">
              No recent stock movements
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
