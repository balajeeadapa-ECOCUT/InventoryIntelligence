import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";

import Landing from "@/pages/landing";
import Dashboard from "@/pages/dashboard";
import Products from "@/pages/products";
import InventoryView from "@/pages/inventory-view";
import Categories from "@/pages/categories";
import Employees from "@/pages/employees";
import Reports from "@/pages/reports";
import PendingApproval from "@/pages/pending-approval";
import NotFound from "@/pages/not-found";

function Router() {
  const { isAuthenticated, isLoading, isPendingApproval, isRejected, approvalData } = useAuth();

  // Show pending approval page for users awaiting admin approval
  if (isPendingApproval) {
    return <PendingApproval user={approvalData?.user} />;
  }

  // Show rejection message for denied users
  if (isRejected) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-600 mb-4">Access Denied</h1>
          <p className="text-gray-600 mb-4">Your account access has been denied by an administrator.</p>
          <button 
            onClick={() => window.location.href = "/api/logout"}
            className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
          >
            Sign Out
          </button>
        </div>
      </div>
    );
  }

  return (
    <Switch>
      {isLoading || !isAuthenticated ? (
        <Route path="/" component={Landing} />
      ) : (
        <>
          <Route path="/" component={Dashboard} />
          <Route path="/products" component={Products} />
          <Route path="/inventory-view" component={InventoryView} />
          <Route path="/categories" component={Categories} />
          <Route path="/employees" component={Employees} />
          <Route path="/reports" component={Reports} />
        </>
      )}
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
