import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { useAuth } from "@/hooks/useAuth";
import { AIChatWidget } from "@/components/ai/ai-chat-widget";

import Landing from "@/pages/landing";
import Login from "@/pages/login";
import Signup from "@/pages/signup";
import Dashboard from "@/pages/dashboard";
import Products from "@/pages/products";
import InventoryView from "@/pages/inventory-view";
import Categories from "@/pages/categories";
import Employees from "@/pages/employees";
import Reports from "@/pages/reports";
import Settings from "@/pages/settings";
import PendingApproval from "@/pages/pending-approval";
import NotFound from "@/pages/not-found";
import AIInsights from "@/pages/ai-insights";

function Router() {
  const { isAuthenticated, isLoading, isPendingApproval, isRejected, logout } = useAuth();
  const [location] = useLocation();

  // Public routes - allow login and signup pages
  const publicRoutes = ["/login", "/signup", "/pending-approval"];
  const isPublicRoute = publicRoutes.includes(location);

  // Show loading state
  if (isLoading && !isPublicRoute) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // Show pending approval page
  if (isPendingApproval) {
    return <PendingApproval />;
  }

  // Show rejected page
  if (isRejected) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-600 mb-4">Access Denied</h1>
          <p className="text-gray-600 mb-4">Your account access has been denied by an administrator.</p>
          <button 
            onClick={logout}
            className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
            data-testid="signout-btn"
          >
            Sign Out
          </button>
        </div>
      </div>
    );
  }

  // Public routes available without authentication
  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route path="/signup" component={Signup} />
      <Route path="/pending-approval" component={PendingApproval} />
      
      {!isAuthenticated ? (
        <Route path="/" component={Landing} />
      ) : (
        <>
          <Route path="/" component={Dashboard} />
          <Route path="/products" component={Products} />
          <Route path="/inventory-view" component={InventoryView} />
          <Route path="/categories" component={Categories} />
          <Route path="/ai-insights" component={AIInsights} />
          <Route path="/employees" component={Employees} />
          <Route path="/reports" component={Reports} />
          <Route path="/settings" component={Settings} />
        </>
      )}
      
      <Route component={isAuthenticated ? NotFound : Landing} />
    </Switch>
  );
}

function AuthenticatedContent() {
  const { isAuthenticated } = useAuth();
  
  return (
    <>
      <Router />
      {isAuthenticated && <AIChatWidget />}
    </>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Toaster />
      <AuthenticatedContent />
    </QueryClientProvider>
  );
}

export default App;
