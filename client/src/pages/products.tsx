import { useState, useEffect } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ProductForm } from "@/components/products/product-form";
import { BarcodeScanner } from "@/components/products/barcode-scanner";
import { BulkUpload } from "@/components/products/bulk-upload";
import { BulkStockUpload } from "@/components/products/bulk-stock-upload";
import { StockAdjustment } from "@/components/products/stock-adjustment";
import { QRLabelPrinter, PrintQRButton } from "@/components/inventory/qr-label-printer";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { usePermissions, Can } from "@/lib/permissions";
import { useQuery } from "@tanstack/react-query";
import { useWebSocket } from "@/hooks/useWebSocket";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, Upload, Search, Filter, Edit, Trash2, Package, TrendingUp, TrendingDown, QrCode, Printer } from "lucide-react";
import type { ProductWithCategory } from "@shared/schema";

export default function Products() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [productFormOpen, setProductFormOpen] = useState(false);
  const [editProductFormOpen, setEditProductFormOpen] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [bulkUploadOpen, setBulkUploadOpen] = useState(false);
  const [bulkStockUploadOpen, setBulkStockUploadOpen] = useState(false);
  const [stockAdjustmentOpen, setStockAdjustmentOpen] = useState(false);
  const [qrLabelPrinterOpen, setQrLabelPrinterOpen] = useState(false);
  const [selectedProducts, setSelectedProducts] = useState<number[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<number | undefined>();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [productToDelete, setProductToDelete] = useState<any>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  
  const { isAuthenticated, isLoading } = useAuth();
  const { data: permissionsData } = usePermissions();
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

  const handleScan = async (scanned: string) => {
  setScannerOpen(false);
  const raw = scanned.trim();
  try {
    const parsed = JSON.parse(raw);
    // If QR code contains a product id, fetch the product directly
    if (parsed.id) {
      const productId = Number(parsed.id);
      try {
        const resp = await fetch(`/api/products/${productId}`);
        if (resp.ok) {
          const product = await resp.json();
          toast({ title: "Product Found", description: `Found: ${product.name}` });
          // Set the product name as the search term so it appears in results
          handleSearch(product.name);
          return;
        }
      } catch {}
    }
    // Fallback: use barcode, sku, or name for searching
    const barcode = String(parsed.barcode || "").trim();
    const sku = String(parsed.sku || "").trim();
    const name = String(parsed.name || "").trim();
    const searchTerm = barcode || sku || name || raw;
    toast({ title: "QR Code Scanned", description: `Searching: ${searchTerm}` });
    handleSearch(searchTerm);
    return;
  } catch { /* not JSON */ }
  toast({ title: "Barcode Scanned", description: `Searching: ${raw}` });
  handleSearch(raw);
}

  const handleDelete = async () => {
    if (!productToDelete) return;
    
    setIsDeleting(true);
    try {
      const response = await fetch(`/api/products/${productToDelete.id}`, {
        method: 'DELETE',
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to delete product');
      }
      
      toast({
        title: "Product Deleted",
        description: `${productToDelete.name} has been removed from inventory.`,
      });
      
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to delete product",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
      setDeleteDialogOpen(false);
      setProductToDelete(null);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedProducts.length === 0) return;
    
    setIsBulkDeleting(true);
    let successCount = 0;
    let errorCount = 0;
    
    try {
      for (const productId of selectedProducts) {
        try {
          const response = await fetch(`/api/products/${productId}`, {
            method: 'DELETE',
          });
          
          if (response.ok) {
            successCount++;
          } else {
            errorCount++;
          }
        } catch {
          errorCount++;
        }
      }
      
      if (successCount > 0) {
        toast({
          title: "Products Deleted",
          description: `Successfully deleted ${successCount} product${successCount !== 1 ? 's' : ''}.${errorCount > 0 ? ` ${errorCount} failed.` : ''}`,
        });
        queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      } else {
        toast({
          title: "Error",
          description: "Failed to delete products",
          variant: "destructive",
        });
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to delete products",
        variant: "destructive",
      });
    } finally {
      setIsBulkDeleting(false);
      setBulkDeleteDialogOpen(false);
      setSelectedProducts([]);
    }
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
            <div className="flex gap-2 flex-wrap">
              {selectedProducts.length > 0 && (
                <>
                  <Can permission="canManageProducts">
                    <Button 
                      variant="outline" 
                      onClick={() => setBulkDeleteDialogOpen(true)}
                      className="bg-red-50 border-red-200 text-red-700 hover:bg-red-100"
                      data-testid="bulk-delete-btn"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete Selected ({selectedProducts.length})
                    </Button>
                  </Can>
                  <Button 
                    variant="outline" 
                    onClick={() => setQrLabelPrinterOpen(true)}
                    className="bg-purple-50 border-purple-200 text-purple-700 hover:bg-purple-100"
                    data-testid="batch-print-qr-btn"
                  >
                    <Printer className="h-4 w-4 mr-2" />
                    Print {selectedProducts.length} QR Labels
                  </Button>
                </>
              )}
              <Can permission="canManageProducts">
                <Button variant="outline" onClick={() => setBulkUploadOpen(true)}>
                  <Upload className="h-4 w-4 mr-2" />
                  Bulk Upload
                </Button>
                <Button variant="outline" onClick={() => setBulkStockUploadOpen(true)}>
                  <TrendingUp className="h-4 w-4 mr-2" />
                  Stock Movements
                </Button>
                <Button onClick={() => setProductFormOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Product
                </Button>
              </Can>
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
                      {(Array.isArray(categories) ? categories : []).map((category: any) => (
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
                        <TableHead className="w-12">
                          <Checkbox
                            checked={selectedProducts.length === productsData?.products?.length && productsData?.products?.length > 0}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setSelectedProducts(productsData?.products?.map((p: any) => p.id) || []);
                              } else {
                                setSelectedProducts([]);
                              }
                            }}
                            data-testid="select-all-products"
                          />
                        </TableHead>
                        <TableHead>Product</TableHead>
                        <TableHead>SKU</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead>Company</TableHead>
                        <TableHead>Bin Location</TableHead>
                        <Can permission="canViewSupplier">
                          <TableHead>Supplier</TableHead>
                        </Can>
                        <TableHead>Stock</TableHead>
                        <Can permission="canViewPrices">
                          <TableHead>Price</TableHead>
                          <TableHead>Total Value</TableHead>
                        </Can>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(productsData?.products || []).map((product: any) => (
                        <TableRow 
                          key={product.id}
                          className={selectedProducts.includes(product.id) ? "bg-purple-50" : ""}
                          data-testid={`product-row-${product.id}`}
                        >
                          <TableCell>
                            <Checkbox
                              checked={selectedProducts.includes(product.id)}
                              onCheckedChange={(checked) => {
                                if (checked) {
                                  setSelectedProducts([...selectedProducts, product.id]);
                                } else {
                                  setSelectedProducts(selectedProducts.filter(id => id !== product.id));
                                }
                              }}
                              data-testid={`select-product-${product.id}`}
                            />
                          </TableCell>
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
                            <Badge variant="secondary" className="font-medium">
                              {product.company || "EcoCut"}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-mono text-sm">
                            {product.binLocation || (
                              <span className="text-gray-400">—</span>
                            )}
                          </TableCell>
                          <Can permission="canViewSupplier">
                            <TableCell className="text-sm">
                              {product.supplierName || (
                                <span className="text-gray-400">—</span>
                              )}
                            </TableCell>
                          </Can>
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
                          <Can permission="canViewPrices">
                            <TableCell className="font-medium">
                              ₹{parseFloat(product.unitPrice.toString()).toFixed(2)}
                            </TableCell>
                            <TableCell className="font-medium text-purple-700">
                              ₹{(parseFloat(product.unitPrice.toString()) * product.currentStock).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </TableCell>
                          </Can>
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
                            <div className="flex items-center gap-1 justify-end">
                              <PrintQRButton product={product} size="icon" variant="ghost" />
                              <Can permission="canManageStock">
                                <Button 
                                  variant="ghost" 
                                  size="icon"
                                  onClick={() => {
                                    setSelectedProduct(product);
                                    setStockAdjustmentOpen(true);
                                  }}
                                  title="Stock In/Out"
                                  data-testid={`button-stock-${product.id}`}
                                >
                                  <TrendingUp className="h-4 w-4 text-green-600" />
                                </Button>
                              </Can>
                              <Can permission="canManageProducts">
                                <Button 
                                  variant="ghost" 
                                  size="icon"
                                  onClick={() => {
                                    setSelectedProduct(product);
                                    setEditProductFormOpen(true);
                                  }}
                                  title="Edit Product"
                                  data-testid={`button-edit-product-${product.id}`}
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <Button 
                                  variant="ghost" 
                                  size="icon"
                                  onClick={() => {
                                    setProductToDelete(product);
                                    setDeleteDialogOpen(true);
                                  }}
                                  title="Delete Product"
                                  data-testid={`button-delete-product-${product.id}`}
                                >
                                  <Trash2 className="h-4 w-4 text-red-500" />
                                </Button>
                              </Can>
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
      
      <ProductForm
        open={editProductFormOpen}
        onOpenChange={(open) => {
          setEditProductFormOpen(open);
          if (!open) setSelectedProduct(null);
        }}
        product={selectedProduct}
      />
      
      <BarcodeScanner
        open={scannerOpen}
        onOpenChange={setScannerOpen}
        onScan={handleScan}
      />

      <BulkUpload
        open={bulkUploadOpen}
        onOpenChange={setBulkUploadOpen}
      />

      <BulkStockUpload
        open={bulkStockUploadOpen}
        onOpenChange={setBulkStockUploadOpen}
      />

      <StockAdjustment
        open={stockAdjustmentOpen}
        onOpenChange={setStockAdjustmentOpen}
        product={selectedProduct}
      />

      <QRLabelPrinter
        products={productsData?.products || []}
        open={qrLabelPrinterOpen}
        onClose={() => {
          setQrLabelPrinterOpen(false);
          setSelectedProducts([]);
        }}
        initialSelectedIds={selectedProducts}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Product</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{productToDelete?.name}"? This action cannot be undone and will remove the product from your inventory.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700"
              data-testid="confirm-delete-btn"
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk Delete Confirmation Dialog */}
      <AlertDialog open={bulkDeleteDialogOpen} onOpenChange={setBulkDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Selected Products</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {selectedProducts.length} selected item{selectedProducts.length !== 1 ? 's' : ''}? This action cannot be undone and will remove the products from your inventory.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isBulkDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBulkDelete}
              disabled={isBulkDeleting}
              className="bg-red-600 hover:bg-red-700"
              data-testid="confirm-bulk-delete-btn"
            >
              {isBulkDeleting ? "Deleting..." : `Delete ${selectedProducts.length} Item${selectedProducts.length !== 1 ? 's' : ''}`}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
