import { useState, useEffect } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Download, FileText, BarChart3, TrendingUp, Loader2 } from "lucide-react";

export default function Reports() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [generatingReport, setGeneratingReport] = useState<string | null>(null);
  const { isAuthenticated, isLoading } = useAuth();
  const { toast } = useToast();

  // Function to download a report
  const downloadReport = async (reportType: string, endpoint: string, filename: string) => {
    setGeneratingReport(reportType);
    try {
      const response = await fetch(endpoint, {
        credentials: 'include',
      });
      
      if (!response.ok) {
        throw new Error('Failed to generate report');
      }
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast({
        title: "Report Downloaded",
        description: `${reportType} has been downloaded successfully.`,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to generate report. Please try again.",
        variant: "destructive",
      });
    } finally {
      setGeneratingReport(null);
    }
  };

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

  const reportTypes = [
    {
      title: "Inventory Report",
      description: "Current stock levels and product details",
      icon: FileText,
      action: () => downloadReport(
        "Inventory Report",
        "/api/reports/inventory",
        `Inventory_Report_${new Date().toISOString().split('T')[0]}.xlsx`
      ),
    },
    {
      title: "Stock Movement Report",
      description: "History of all stock movements",
      icon: TrendingUp,
      action: () => downloadReport(
        "Stock Movement Report",
        "/api/reports/stock-movements",
        `Stock_Movements_${new Date().toISOString().split('T')[0]}.xlsx`
      ),
    },
    {
      title: "Low Stock Alert",
      description: "Products below minimum stock levels",
      icon: BarChart3,
      action: () => downloadReport(
        "Low Stock Alert",
        "/api/reports/low-stock",
        `Low_Stock_Report_${new Date().toISOString().split('T')[0]}.xlsx`
      ),
    },
  ];

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
          title="Reports & Analytics"
          subtitle="Generate and export inventory reports"
          onMenuClick={() => setSidebarOpen(true)}
        />
        
        <main className="flex-1 overflow-auto p-4 lg:p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {reportTypes.map((report, index) => (
              <Card key={index} className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="flex items-center space-x-3">
                    <div className="p-2 bg-blue-50 rounded-lg">
                      <report.icon className="h-6 w-6 text-blue-600" />
                    </div>
                    <CardTitle className="text-lg">{report.title}</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-600 mb-4">{report.description}</p>
                  <Button 
                    onClick={report.action} 
                    className="w-full"
                    disabled={generatingReport !== null}
                    data-testid={`btn-generate-${report.title.toLowerCase().replace(/\s+/g, '-')}`}
                  >
                    {generatingReport === report.title ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <Download className="h-4 w-4 mr-2" />
                        Generate Report
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card className="mt-8">
            <CardHeader>
              <CardTitle>Report History</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8">
                <p className="text-gray-500">No reports generated yet</p>
                <p className="text-sm text-gray-400 mt-2">
                  Generated reports will appear here for download
                </p>
              </div>
            </CardContent>
          </Card>
        </main>
      </div>
    </div>
  );
}
