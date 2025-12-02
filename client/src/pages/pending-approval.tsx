import { Clock, Mail, Shield } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface PendingApprovalProps {
  user?: {
    firstName?: string | null;
    lastName?: string | null;
    email?: string | null;
  };
}

export default function PendingApproval({ user }: PendingApprovalProps) {
  const handleLogout = () => {
    window.location.href = "/api/logout";
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full">
        <Card>
          <CardHeader className="text-center">
            <div className="mx-auto w-12 h-12 bg-yellow-100 rounded-full flex items-center justify-center mb-4">
              <Clock className="w-6 h-6 text-yellow-600" />
            </div>
            <CardTitle className="text-xl">Account Pending Approval</CardTitle>
            <CardDescription>
              Your account is awaiting approval from an administrator
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-center space-y-3">
              <p className="text-sm text-gray-600">
                Hello {user?.firstName && user?.lastName 
                  ? `${user.firstName} ${user.lastName}`
                  : user?.email || 'there'
                }!
              </p>
              
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <div className="flex items-start space-x-3">
                  <Shield className="w-5 h-5 text-yellow-600 mt-0.5" />
                  <div className="text-left">
                    <p className="text-sm font-medium text-yellow-800">
                      Access Request Submitted
                    </p>
                    <p className="text-xs text-yellow-700 mt-1">
                      An administrator will review your request and approve access to the inventory system.
                    </p>
                  </div>
                </div>
              </div>

              <div className="text-left space-y-2">
                <h4 className="font-medium text-gray-900">What happens next?</h4>
                <ul className="text-sm text-gray-600 space-y-1">
                  <li className="flex items-center space-x-2">
                    <div className="w-1.5 h-1.5 bg-blue-600 rounded-full"></div>
                    <span>An admin will receive your access request</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <div className="w-1.5 h-1.5 bg-blue-600 rounded-full"></div>
                    <span>You'll receive notification once approved</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <div className="w-1.5 h-1.5 bg-blue-600 rounded-full"></div>
                    <span>You can then access the full system</span>
                  </li>
                </ul>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-center space-x-2">
                  <Mail className="w-4 h-4 text-blue-600" />
                  <p className="text-sm text-blue-800">
                    Need help? Contact your system administrator
                  </p>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t">
              <Button 
                onClick={handleLogout}
                variant="outline" 
                className="w-full"
              >
                Sign Out
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}