import { useState, useEffect } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ProductForm } from "@/components/products/product-form";
import { BarcodeScanner } from "@/components/products/barcode-scanner";
import { BulkUpload } from "@/components/products/bulk-upload";
import { StockAdjustment } from "@/components/products/stock-adjustment";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { useWebSocket } from "@/hooks/useWebSocket";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, Upload, Search, Filter, Edit, Trash2, Package, TrendingUp, TrendingDown } from "lucide-react";
import type { ProductWithCategory } from "@shared/schema";

export default function Products() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [productFormOpen, setProductFormOpen] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [bulkUploadOpen, setBulkUploadOpen] = useState(false);
  const [stockAdjustmentOpen, setStockAdjustmentOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<number | undefined>();
  
  const { isAuthenticated, isLoading } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Parse URL search params
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const searchParam = urlParams.get('search');
    if (searchParam) {
      setSearchQuery(searchParam);
    }
  }, []);

  // WebSocket for real-time updates
  useWebSocket((message) => {
    switch (message.type) {
      case "PRODUCT_CREATED":
      case "PRODUCT_UPDATED":
      case "PRODUCT_DELETED":
      case "STOCK_UPDATED":
        queryClient.invalidateQueries({ queryKey: ["/api/products"] });
        break;
    }
  });

  // Fetch products with search and filters
  const { data: productsData, isLoading: productsLoading } = useQuery({
    queryKey: ["/api/products", searchQuery, selectedCategory],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (searchQuery) params.append('search', searchQuery);
      if (selectedCategory) params.append('categoryId', selectedCategory.toString());
      
      const response = await fetch(`/api/products?${params}`);
      if (!response.ok) throw new Error('Failed to fetch products');
      return response.json();
    },
  });

  // Fetch categories for filter
  const { data: categories } = useQuery({
    queryKey: ["/api/categories"],
  });

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      toast({
        title: "Unauthorized",
        description: "You are logged out. Logging in again...",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/api/login";
      }, 500);
      return;
    }
  }, [isAuthenticated, isLoading, toast]);

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    // Update URL without page reload
    const url = new URL(window.location.href);
    if (query) {
      url.searchParams.set('search', query);
    } else {
      url.searchParams.delete('search');
    }
    window.history.replaceState({}, '', url);
  };

  const handleScan = (barcode: string) => {
    toast({
      title: "Barcode Scanned",
      description: `Searching for product with barcode: ${barcode}`,
    });
    setSearchQuery(barcode);
    setScannerOpen(false);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      
      {/* Sidebar */}
      <div className={`${sidebarOpen ? "translate-x-0" : "-translate-x-full"} lg:translate-x-0 transition-transform duration-300 ease-in-out fixed lg:static inset-y-0 left-0 z-50`}>
        <Sidebar isOpen={true} onClose={() => setSidebarOpen(false)} />
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header
          title="Product Management"
          subtitle="Manage your inventory products"
          onMenuClick={() => setSidebarOpen(true)}
          onScanClick={() => setScannerOpen(true)}
          onSearch={handleSearch}
          searchQuery={searchQuery}
        />
        
        <main className="flex-1 overflow-auto p-4 lg:p-6">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">All Products</h3>
              <p className="text-gray-600">Manage your product catalog</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setBulkUploadOpen(true)}>
                <Upload className="h-4 w-4 mr-2" />
                Bulk Upload
              </Button>
              <Button onClick={() => setProductFormOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add Product
              </Button>
            </div>
          </div>

          {/* Search and Filter Controls */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Search className="h-5 w-5" />
                Search & Filter Products
              </CardTitle>
              <CardDescription>
                Find products by name, SKU, barcode, or category
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1">
                  <Input
                    placeholder="Search by name, SKU, or barcode..."
                    value={searchQuery}
                    onChange={(e) => handleSearch(e.target.value)}
                    className="w-full"
                  />
                </div>
                <div className="w-full sm:w-48">
                  <Select
                    value={selectedCategory?.toString() || "all"}
                    onValueChange={(value) => setSelectedCategory(value === "all" ? undefined : Number(value))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="All Categories" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Categories</SelectItem>
                      {(categories || []).map((category: any) => (
                        <SelectItem key={category.id} value={category.id.toString()}>
                          {category.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {(searchQuery || selectedCategory) && (
                  <Button
                    variant="outline"
                    onClick={() => {
                      setSearchQuery("");
                      setSelectedCategory(undefined);
                      handleSearch("");
                    }}
                  >
                    Clear Filters
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Products Table */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Package className="h-5 w-5" />
                  Products
                  {productsData && (
                    <Badge variant="secondary">
                      {productsData.total} total
                    </Badge>
                  )}
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {productsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                  <span className="ml-2 text-gray-600">Loading products...</span>
                </div>
              ) : !productsData?.products?.length ? (
                <div className="text-center py-8">
                  <Package className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    {searchQuery || selectedCategory ? "No products found" : "No products yet"}
                  </h3>
                  <p className="text-gray-500 mb-4">
                    {searchQuery || selectedCategory 
                      ? "Try adjusting your search terms or filters"
                      : "Get started by adding your first product to the inventory"
                    }
                  </p>
                  <Button onClick={() => setProductFormOpen(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Product
                  </Button>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Product</TableHead>
                        <TableHead>SKU</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead>Stock</TableHead>
                        <TableHead>Price</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(productsData?.products || []).map((product: any) => (
                        <TableRow key={product.id}>
                          <TableCell>
                            <div className="flex items-center space-x-3">
                              {product.imageUrl ? (
                                <img
                                  src={product.imageUrl}
                                  alt={product.name}
                                  className="w-10 h-10 object-cover rounded border"
                                />
                              ) : (
                                <div className="w-10 h-10 bg-gray-100 rounded border flex items-center justify-center">
                                  <Package className="h-5 w-5 text-gray-400" />
                                </div>
                              )}
                              <div>
                                <div className="font-medium">{product.name}</div>
                                {product.barcode && (
                                  <div className="text-sm text-gray-500">
                                    Barcode: {product.barcode}
                                  </div>
                                )}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="font-mono text-sm">
                            {product.sku}
                          </TableCell>
                          <TableCell>
                            {product.category ? (
                              <Badge variant="outline">
                                {product.category.name}
                              </Badge>
                            ) : (
                              <span className="text-gray-400">Uncategorized</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <span className={`font-medium ${
                                product.currentStock <= (product.minStockLevel || 0)
                                  ? 'text-red-600'
                                  : product.currentStock <= (product.minStockLevel || 0) * 2
                                  ? 'text-yellow-600'
                                  : 'text-green-600'
                              }`}>
                                {product.currentStock}
                              </span>
                              <span className="text-gray-500 text-sm">
                                units
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="font-medium">
                            ₹{parseFloat(product.unitPrice.toString()).toFixed(2)}
                          </TableCell>
                          <TableCell>
                            <Badge variant={
                              product.currentStock <= 0
                                ? "destructive"
                                : product.currentStock <= (product.minStockLevel || 0)
                                ? "secondary"
                                : "default"
                            }>
                              {product.currentStock <= 0
                                ? "Out of Stock"
                                : product.currentStock <= (product.minStockLevel || 0)
                                ? "Low Stock"
                                : "In Stock"
                              }
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center gap-2 justify-end">
                              <Button 
                                variant="ghost" 
                                size="sm"
                                onClick={() => {
                                  setSelectedProduct(product);
                                  setStockAdjustmentOpen(true);
                                }}
                                title="Stock In/Out"
                              >
                                <TrendingUp className="h-4 w-4 text-green-600" />
                              </Button>
                              <Button variant="ghost" size="sm">
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="sm">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </main>
      </div>

      {/* Modals */}
      <ProductForm
        open={productFormOpen}
        onOpenChange={setProductFormOpen}
      />
      
      <BarcodeScanner
        open={scannerOpen}
        onOpenChange={setScannerOpen}
        onScan={(barcode) => {
          toast({
            title: "Barcode Scanned",
            description: `Barcode: ${barcode}`,
          });
        }}
      />

      <BulkUpload
        open={bulkUploadOpen}
        onOpenChange={setBulkUploadOpen}
      />

      <StockAdjustment
        open={stockAdjustmentOpen}
        onOpenChange={setStockAdjustmentOpen}
        product={selectedProduct}
      />
    </div>
  );
}
