import { useState, useEffect } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { ProductForm } from "@/components/products/product-form";
import { BarcodeScanner } from "@/components/products/barcode-scanner";
import { BulkUpload } from "@/components/products/bulk-upload";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Plus, Upload } from "lucide-react";

export default function Products() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [productFormOpen, setProductFormOpen] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [bulkUploadOpen, setBulkUploadOpen] = useState(false);
  const { isAuthenticated, isLoading } = useAuth();
  const { toast } = useToast();

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

          {/* Product list would go here */}
          <div className="text-center py-12">
            <p className="text-gray-500 mb-4">Product management interface coming soon</p>
            <Button onClick={() => setProductFormOpen(true)}>
              Add Your First Product
            </Button>
          </div>
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
    </div>
  );
}
