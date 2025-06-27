import { useState, useEffect } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { EmployeeForm } from "@/components/employees/employee-form";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { UserPlus } from "lucide-react";

export default function Employees() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [employeeFormOpen, setEmployeeFormOpen] = useState(false);
  const { isAuthenticated, isLoading, user } = useAuth();
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

  // Check if user has permission to manage employees
  const canManageEmployees = user?.role === "admin" || user?.role === "manager";

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
          title="Employee Management"
          subtitle="Manage team access and permissions"
          onMenuClick={() => setSidebarOpen(true)}
        />
        
        <main className="flex-1 overflow-auto p-4 lg:p-6">
          {canManageEmployees ? (
            <>
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Team Members</h3>
                  <p className="text-gray-600">Manage employee access and roles</p>
                </div>
                <Button onClick={() => setEmployeeFormOpen(true)}>
                  <UserPlus className="h-4 w-4 mr-2" />
                  Add Employee
                </Button>
              </div>

              {/* Employee list would go here */}
              <div className="text-center py-12">
                <p className="text-gray-500 mb-4">Employee management interface coming soon</p>
                <Button onClick={() => setEmployeeFormOpen(true)}>
                  Add First Employee
                </Button>
              </div>
            </>
          ) : (
            <div className="text-center py-12">
              <div className="max-w-md mx-auto">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Access Restricted</h3>
                <p className="text-gray-600">
                  You don't have permission to manage employees. Please contact your administrator.
                </p>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Modals */}
      {canManageEmployees && (
        <EmployeeForm
          open={employeeFormOpen}
          onOpenChange={setEmployeeFormOpen}
        />
      )}
    </div>
  );
}
