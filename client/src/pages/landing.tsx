import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Package, BarChart3, Users, Shield } from "lucide-react";

export default function Landing() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="container mx-auto px-4 py-16">
        <div className="text-center mb-16">
          <div className="flex items-center justify-center space-x-3 mb-6">
            <div className="w-12 h-12 bg-blue-600 rounded-lg flex items-center justify-center">
              <Package className="h-8 w-8 text-white" />
            </div>
            <h1 className="text-4xl font-bold text-gray-900">StockFlow</h1>
          </div>
          <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
            Professional inventory management system with real-time tracking and employee access control
          </p>
          <Button
            size="lg"
            className="bg-blue-600 hover:bg-blue-700"
            onClick={() => window.location.href = "/api/login"}
          >
            Sign In to Continue
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
          <Card>
            <CardHeader className="text-center">
              <Package className="h-12 w-12 text-blue-600 mx-auto mb-4" />
              <CardTitle>Real-time Tracking</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>
                Monitor inventory levels in real-time with instant updates across all devices
              </CardDescription>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="text-center">
              <BarChart3 className="h-12 w-12 text-blue-600 mx-auto mb-4" />
              <CardTitle>Smart Analytics</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>
                Get insights into stock movements, trends, and automated low-stock alerts
              </CardDescription>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="text-center">
              <Users className="h-12 w-12 text-blue-600 mx-auto mb-4" />
              <CardTitle>Team Collaboration</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>
                Role-based access control for secure team collaboration and accountability
              </CardDescription>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="text-center">
              <Shield className="h-12 w-12 text-blue-600 mx-auto mb-4" />
              <CardTitle>Secure Access</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>
                Enterprise-grade security with employee access control and audit trails
              </CardDescription>
            </CardContent>
          </Card>
        </div>

        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            Ready to streamline your inventory management?
          </h2>
          <p className="text-gray-600 mb-8">
            Join thousands of businesses that trust StockFlow for their inventory needs
          </p>
          <Button
            size="lg"
            variant="outline"
            onClick={() => window.location.href = "/api/login"}
          >
            Get Started
          </Button>
        </div>
      </div>
    </div>
  );
}
