import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Package, AlertTriangle, XCircle, IndianRupee, Building2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

interface CompanyStats {
  company: string;
  totalProducts: number;
  lowStockItems: number;
  outOfStockItems: number;
  totalValue: number;
}

const companyColors: Record<string, { bg: string; text: string; border: string }> = {
  EcoCut: { bg: "bg-green-50", text: "text-green-700", border: "border-green-200" },
  AGIS: { bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-200" },
  EcoFast: { bg: "bg-purple-50", text: "text-purple-700", border: "border-purple-200" },
};

export function StockStatusCards() {
  const { data: stats, isLoading } = useQuery<{
    totalProducts: number;
    lowStockItems: number;
    outOfStockItems: number;
    totalValue: number;
  }>({
    queryKey: ["/api/dashboard/stats"],
  });

  const { data: companyStats, isLoading: companyLoading } = useQuery<CompanyStats[]>({
    queryKey: ["/api/dashboard/company-stats"],
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
      value: `₹${((stats?.totalValue || 0) / 1000).toFixed(0)}K`,
      change: "+8.2%",
      changeType: "positive",
      icon: IndianRupee,
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
    <>
      {/* Overall Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {cards.map((card, index) => (
          <Card key={index} data-testid={`stat-card-${card.title.toLowerCase().replace(/\s+/g, '-')}`}>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-600 text-sm font-medium">{card.title}</p>
                  <p className="text-3xl font-bold text-gray-900 mt-1" data-testid={`stat-value-${card.title.toLowerCase().replace(/\s+/g, '-')}`}>{card.value}</p>
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

      {/* Company-Specific Metrics */}
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-4">
          <Building2 className="h-5 w-5 text-gray-600" />
          <h2 className="text-lg font-semibold text-gray-900">Metrics by Company</h2>
        </div>
        
        {companyLoading ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {[...Array(3)].map((_, i) => (
              <Card key={i} className="animate-pulse">
                <CardHeader className="pb-2">
                  <div className="h-6 bg-gray-200 rounded w-24"></div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4">
                    {[...Array(4)].map((_, j) => (
                      <div key={j} className="space-y-1">
                        <div className="h-3 bg-gray-200 rounded w-16"></div>
                        <div className="h-5 bg-gray-200 rounded w-10"></div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {companyStats?.map((company) => {
              const colors = companyColors[company.company] || companyColors.EcoCut;
              return (
                <Card 
                  key={company.company} 
                  className={`border-2 ${colors.border}`}
                  data-testid={`company-card-${company.company.toLowerCase()}`}
                >
                  <CardHeader className={`pb-2 ${colors.bg}`}>
                    <CardTitle className={`flex items-center gap-2 ${colors.text}`}>
                      <Building2 className="h-5 w-5" />
                      {company.company}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-1">
                          <Package className="h-3.5 w-3.5 text-blue-500" />
                          <p className="text-xs text-gray-500">Products</p>
                        </div>
                        <p className="text-xl font-bold text-gray-900" data-testid={`company-${company.company.toLowerCase()}-products`}>
                          {company.totalProducts}
                        </p>
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center gap-1">
                          <AlertTriangle className="h-3.5 w-3.5 text-yellow-500" />
                          <p className="text-xs text-gray-500">Low Stock</p>
                        </div>
                        <p className="text-xl font-bold text-gray-900" data-testid={`company-${company.company.toLowerCase()}-low-stock`}>
                          {company.lowStockItems}
                        </p>
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center gap-1">
                          <XCircle className="h-3.5 w-3.5 text-red-500" />
                          <p className="text-xs text-gray-500">Out of Stock</p>
                        </div>
                        <p className="text-xl font-bold text-gray-900" data-testid={`company-${company.company.toLowerCase()}-out-of-stock`}>
                          {company.outOfStockItems}
                        </p>
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center gap-1">
                          <IndianRupee className="h-3.5 w-3.5 text-green-500" />
                          <p className="text-xs text-gray-500">Value</p>
                        </div>
                        <p className="text-xl font-bold text-gray-900" data-testid={`company-${company.company.toLowerCase()}-value`}>
                          ₹{(company.totalValue / 1000).toFixed(0)}K
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
