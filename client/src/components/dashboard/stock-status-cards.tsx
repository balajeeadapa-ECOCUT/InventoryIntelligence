import { Card, CardContent } from "@/components/ui/card";
import { Package, AlertTriangle, XCircle, DollarSign } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

export function StockStatusCards() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ["/api/dashboard/stats"],
  });

  const cards = [
    {
      title: "Total Products",
      value: stats?.totalProducts || 0,
      change: "+12%",
      changeType: "positive",
      icon: Package,
      iconBg: "bg-blue-50",
      iconColor: "text-blue-600",
    },
    {
      title: "Low Stock Items",
      value: stats?.lowStockItems || 0,
      change: "+5",
      changeType: "negative",
      icon: AlertTriangle,
      iconBg: "bg-yellow-50",
      iconColor: "text-yellow-600",
    },
    {
      title: "Out of Stock",
      value: stats?.outOfStockItems || 0,
      change: "-2",
      changeType: "positive",
      icon: XCircle,
      iconBg: "bg-red-50",
      iconColor: "text-red-600",
    },
    {
      title: "Total Value",
      value: `$${((stats?.totalValue || 0) / 1000).toFixed(0)}K`,
      change: "+8.2%",
      changeType: "positive",
      icon: DollarSign,
      iconBg: "bg-green-50",
      iconColor: "text-green-600",
    },
  ];

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {[...Array(4)].map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="space-y-2">
                  <div className="h-4 bg-gray-200 rounded w-24"></div>
                  <div className="h-8 bg-gray-200 rounded w-16"></div>
                </div>
                <div className="w-12 h-12 bg-gray-200 rounded-lg"></div>
              </div>
              <div className="mt-4">
                <div className="h-3 bg-gray-200 rounded w-20"></div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
      {cards.map((card, index) => (
        <Card key={index}>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm font-medium">{card.title}</p>
                <p className="text-3xl font-bold text-gray-900 mt-1">{card.value}</p>
              </div>
              <div className={`w-12 h-12 ${card.iconBg} rounded-lg flex items-center justify-center`}>
                <card.icon className={`h-6 w-6 ${card.iconColor}`} />
              </div>
            </div>
            <div className="flex items-center mt-4 text-sm">
              <span className={card.changeType === "positive" ? "text-green-600" : "text-red-600"}>
                {card.change}
              </span>
              <span className="text-gray-600 ml-1">from last month</span>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
