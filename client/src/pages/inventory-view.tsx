import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Eye, Package, Search, Filter } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import type { ProductWithCategory, Category } from "@shared/schema";

export default function InventoryView() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [stockFilter, setStockFilter] = useState<string>("all");
  const { user } = useAuth();

  const { data: products = { products: [], total: 0 }, isLoading: productsLoading } = useQuery<{
    products: ProductWithCategory[];
    total: number;
  }>({
    queryKey: ["/api/products", { 
      search: searchQuery || undefined,
      categoryId: selectedCategory !== "all" ? Number(selectedCategory) : undefined,
      stockLevel: stockFilter !== "all" ? stockFilter : undefined,
    }],
  });

  const { data: categories = [] } = useQuery<Category[]>({
    queryKey: ["/api/categories"],
  });

  const getStockBadge = (currentStock: number, minStock: number = 0) => {
    if (currentStock === 0) {
      return <Badge variant="destructive">Out of Stock</Badge>;
    } else if (currentStock <= minStock) {
      return <Badge variant="secondary">Low Stock</Badge>;
    } else {
      return <Badge variant="default" className="bg-green-100 text-green-800">In Stock</Badge>;
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header 
          title="Inventory View"
          subtitle="Read-only inventory overview"
          onMenuClick={() => setSidebarOpen(true)}
          onSearch={setSearchQuery}
          searchQuery={searchQuery}
        />

        <main className="flex-1 overflow-y-auto p-6">
          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="Search products..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            
            <div className="flex gap-2">
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger className="w-40">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {categories.map((category) => (
                    <SelectItem key={category.id} value={category.id.toString()}>
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={stockFilter} onValueChange={setStockFilter}>
                <SelectTrigger className="w-40">
                  <Package className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Stock Level" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Items</SelectItem>
                  <SelectItem value="low">Low Stock</SelectItem>
                  <SelectItem value="out">Out of Stock</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Results Summary */}
          <div className="mb-6">
            <p className="text-sm text-gray-600">
              Showing {products.products?.length || 0} of {products.total || 0} products
            </p>
          </div>

          {/* Products Grid */}
          {productsLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {[...Array(8)].map((_, i) => (
                <Card key={i} className="animate-pulse">
                  <CardHeader>
                    <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                    <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="h-3 bg-gray-200 rounded"></div>
                      <div className="h-3 bg-gray-200 rounded w-2/3"></div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : products.products?.length === 0 ? (
            <Card className="text-center py-12">
              <CardContent>
                <Package className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No products found</h3>
                <p className="text-gray-600">
                  {searchQuery 
                    ? `No products match "${searchQuery}"`
                    : "No products available in the selected filters"
                  }
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {products.products?.map((product: ProductWithCategory) => (
                <Card key={product.id} className="hover:shadow-md transition-shadow">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <CardTitle className="text-lg leading-tight">{product.name}</CardTitle>
                        <CardDescription className="text-sm mt-1">
                          SKU: {product.sku}
                        </CardDescription>
                      </div>
                      <Eye className="h-4 w-4 text-gray-400 flex-shrink-0 ml-2" />
                    </div>
                  </CardHeader>
                  
                  <CardContent className="space-y-3">
                    {/* Stock Status */}
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Stock:</span>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold">{product.currentStock}</span>
                        {getStockBadge(product.currentStock, (product as any).minStockLevel || 0)}
                      </div>
                    </div>

                    {/* Category */}
                    {product.category && (
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-600">Category:</span>
                        <Badge variant="outline" className="text-xs">
                          {product.category.name}
                        </Badge>
                      </div>
                    )}

                    {/* Price - Hidden for employees */}
                    {user?.role !== 'employee' && (
                      <>
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-gray-600">Unit Price:</span>
                          <span className="text-sm font-semibold">
                            {formatCurrency(Number(product.unitPrice))}
                          </span>
                        </div>

                        {/* Total Value */}
                        <div className="flex items-center justify-between pt-2 border-t">
                          <span className="text-sm font-medium">Total Value:</span>
                          <span className="text-sm font-bold text-green-600">
                            {formatCurrency(product.currentStock * Number(product.unitPrice))}
                          </span>
                        </div>
                      </>
                    )}

                    {/* Description */}
                    {product.description && (
                      <div className="pt-2">
                        <p className="text-xs text-gray-600 line-clamp-2">
                          {product.description}
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}