import { useState, useEffect } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { StockStatusCards } from "@/components/dashboard/stock-status-cards";
import { RecentActivity } from "@/components/dashboard/recent-activity";
import { QuickActions } from "@/components/dashboard/quick-actions";
import { InventoryTable } from "@/components/dashboard/inventory-table";
import { BarcodeScanner } from "@/components/products/barcode-scanner";
import { ProductForm } from "@/components/products/product-form";
import { BulkUpload } from "@/components/products/bulk-upload";
import { useWebSocket } from "@/hooks/useWebSocket";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { isUnauthorizedError } from "@/lib/authUtils";

export default function Dashboard() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [productFormOpen, setProductFormOpen] = useState(false);
  const [bulkUploadOpen, setBulkUploadOpen] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { isAuthenticated, isLoading } = useAuth();

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

  // WebSocket for real-time updates
  useWebSocket((message) => {
    switch (message.type) {
      case "PRODUCT_CREATED":
      case "PRODUCT_UPDATED":
      case "PRODUCT_DELETED":
      case "STOCK_UPDATED":
        queryClient.invalidateQueries({ queryKey: ["/api/products"] });
        queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
        queryClient.invalidateQueries({ queryKey: ["/api/stock-movements"] });
        toast({
          title: "Inventory Updated",
          description: "Stock levels have been updated in real-time",
        });
        break;
    }
  });

  const handleScan = (barcode: string) => {
    toast({
      title: "Barcode Scanned",
      description: `Barcode: ${barcode}`,
    });
    // TODO: Look up product by barcode and show stock adjustment dialog
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
    return null; // Redirect will happen in useEffect
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
          title="Inventory Dashboard"
          subtitle="Real-time stock monitoring"
          onMenuClick={() => setSidebarOpen(true)}
          onScanClick={() => setScannerOpen(true)}
        />
        
        <main className="flex-1 overflow-auto p-4 lg:p-6">
          <StockStatusCards />
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            <RecentActivity />
            <QuickActions 
              onAddProduct={() => setProductFormOpen(true)}
              onScanItem={() => setScannerOpen(true)}
              onBulkUpload={() => setBulkUploadOpen(true)}
            />
          </div>
          
          <InventoryTable />
        </main>
      </div>

      {/* Modals */}
      <BarcodeScanner
        open={scannerOpen}
        onOpenChange={setScannerOpen}
        onScan={handleScan}
      />
      
      <ProductForm
        open={productFormOpen}
        onOpenChange={setProductFormOpen}
      />

      <BulkUpload
        open={bulkUploadOpen}
        onOpenChange={setBulkUploadOpen}
      />
    </div>
  );
}
