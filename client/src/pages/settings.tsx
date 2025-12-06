import { useState, useEffect } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Settings as SettingsIcon, Mail, Bell, User, Palette, Send, CheckCircle, XCircle, Clock } from "lucide-react";

interface StockAlertLog {
  timestamp: string;
  status: 'success' | 'failed' | 'skipped';
  recipient: string;
  lowStockCount: number;
  outOfStockCount: number;
  error?: string;
}

interface AlertStatus {
  enabled: boolean;
  recipient: string;
  smtpConfigured: boolean;
  scheduledTime: string;
  logs: StockAlertLog[];
}

export default function Settings() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [alertsEnabled, setAlertsEnabled] = useState(false);
  const [recipientEmail, setRecipientEmail] = useState("");
  const [hasChanges, setHasChanges] = useState(false);
  const { user, isAuthenticated, isLoading } = useAuth();
  const { toast } = useToast();

  const { data: alertStatus, isLoading: statusLoading, refetch: refetchStatus } = useQuery<AlertStatus>({
    queryKey: ["/api/stock-alerts/status"],
    enabled: isAuthenticated && (user?.role === 'admin'),
  });

  // Sync local state with fetched data
  useEffect(() => {
    if (alertStatus) {
      setAlertsEnabled(alertStatus.enabled);
      setRecipientEmail(alertStatus.recipient === 'not configured' ? '' : alertStatus.recipient);
      setHasChanges(false);
    }
  }, [alertStatus]);

  const saveSettingsMutation = useMutation({
    mutationFn: async () => {
      // Validate that we have a recipient if alerts are enabled
      if (alertsEnabled && !recipientEmail.trim()) {
        throw new Error("Please enter a recipient email address when alerts are enabled");
      }
      const response = await apiRequest("PATCH", "/api/stock-alerts/settings", {
        enabled: alertsEnabled,
        recipient: recipientEmail,
      });
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Settings Saved",
        description: data.message || "Email notification settings updated successfully",
      });
      setHasChanges(false);
      refetchStatus();
    },
    onError: (error: any) => {
      toast({
        title: "Failed to Save",
        description: error.message || "Could not save settings",
        variant: "destructive",
      });
    },
  });

  const sendTestMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/stock-alerts/send");
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Test Email Sent",
        description: data.message,
      });
      refetchStatus();
    },
    onError: (error: any) => {
      toast({
        title: "Failed to Send",
        description: error.message || "Could not send test email",
        variant: "destructive",
      });
    },
  });

  const handleEnabledChange = (checked: boolean) => {
    setAlertsEnabled(checked);
    setHasChanges(true);
  };

  const handleRecipientChange = (value: string) => {
    setRecipientEmail(value);
    setHasChanges(true);
  };

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

  const isAdmin = user?.role === 'admin';

  return (
    <div className="flex h-screen bg-gray-50">
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      
      <div className={`${sidebarOpen ? "translate-x-0" : "-translate-x-full"} lg:translate-x-0 transition-transform duration-300 ease-in-out fixed lg:static inset-y-0 left-0 z-50`}>
        <Sidebar isOpen={true} onClose={() => setSidebarOpen(false)} />
      </div>

      <div className="flex-1 flex flex-col overflow-hidden">
        <Header
          title="Settings"
          subtitle="Configure your application preferences"
          onMenuClick={() => setSidebarOpen(true)}
        />
        
        <main className="flex-1 overflow-auto p-4 lg:p-6">
          <div className="max-w-4xl mx-auto space-y-6">
            
            {isAdmin && (
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Mail className="h-5 w-5 text-blue-600" />
                    <CardTitle>Email Notification Settings</CardTitle>
                  </div>
                  <CardDescription>
                    Configure daily stock alert emails sent at 9:00 AM IST
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {statusLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                    </div>
                  ) : (
                    <>
                      <div className="grid gap-4">
                        <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                          <div className="space-y-1">
                            <Label className="text-base font-medium">Daily Stock Alerts</Label>
                            <p className="text-sm text-gray-500">
                              Receive daily email reports about low and out-of-stock items
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Switch
                              checked={alertsEnabled}
                              onCheckedChange={handleEnabledChange}
                              data-testid="toggle-alerts-enabled"
                            />
                            <span className={`text-sm font-medium ${alertsEnabled ? 'text-green-600' : 'text-gray-500'}`}>
                              {alertsEnabled ? 'Enabled' : 'Disabled'}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                          <div className="space-y-1">
                            <Label htmlFor="recipient-email" className="text-base font-medium">Alert Recipient</Label>
                            <p className="text-sm text-gray-500">
                              Email address receiving stock alerts
                            </p>
                          </div>
                          <div className="flex items-center gap-2 w-64">
                            <Input
                              id="recipient-email"
                              type="email"
                              placeholder="email@example.com"
                              value={recipientEmail}
                              onChange={(e) => handleRecipientChange(e.target.value)}
                              data-testid="input-recipient-email"
                              className="text-right"
                            />
                          </div>
                        </div>

                        <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                          <div className="space-y-1">
                            <Label className="text-base font-medium">SMTP Configuration</Label>
                            <p className="text-sm text-gray-500">
                              Email server settings for sending alerts
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            {alertStatus?.smtpConfigured ? (
                              <Badge className="bg-green-100 text-green-800">
                                <CheckCircle className="h-3 w-3 mr-1" />
                                Configured
                              </Badge>
                            ) : (
                              <Badge variant="secondary">
                                <XCircle className="h-3 w-3 mr-1" />
                                Not Configured
                              </Badge>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                          <div className="space-y-1">
                            <Label className="text-base font-medium">Scheduled Time</Label>
                            <p className="text-sm text-gray-500">
                              When daily alerts are sent
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline">
                              <Clock className="h-3 w-3 mr-1" />
                              {alertStatus?.scheduledTime || '9:00 AM IST'}
                            </Badge>
                          </div>
                        </div>
                      </div>

                      <Separator />

                      {hasChanges && (
                        <div className="flex items-center gap-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                          <div className="flex-1">
                            <p className="text-sm text-yellow-800 font-medium">You have unsaved changes</p>
                            <p className="text-xs text-yellow-600">Click "Save Settings" to apply your changes</p>
                          </div>
                          <Button
                            onClick={() => saveSettingsMutation.mutate()}
                            disabled={saveSettingsMutation.isPending}
                            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700"
                            data-testid="save-settings-btn"
                          >
                            <CheckCircle className="h-4 w-4" />
                            {saveSettingsMutation.isPending ? "Saving..." : "Save Settings"}
                          </Button>
                        </div>
                      )}

                      <div className="flex flex-col sm:flex-row gap-4">
                        <Button
                          onClick={() => sendTestMutation.mutate()}
                          disabled={sendTestMutation.isPending}
                          className="flex items-center gap-2"
                          variant="outline"
                          data-testid="send-test-email-btn"
                        >
                          <Send className="h-4 w-4" />
                          {sendTestMutation.isPending ? "Sending..." : "Send Test Email Now"}
                        </Button>
                        <p className="text-sm text-gray-500 self-center">
                          This will send a stock alert email immediately for testing
                        </p>
                      </div>

                      {alertStatus?.logs && alertStatus.logs.length > 0 && (
                        <>
                          <Separator />
                          <div>
                            <Label className="text-base font-medium mb-3 block">Recent Email Logs</Label>
                            <div className="space-y-2">
                              {alertStatus.logs.map((log: any, index: number) => (
                                <div 
                                  key={index}
                                  className={`flex items-center justify-between p-3 rounded-lg text-sm ${
                                    log.status === 'success' 
                                      ? 'bg-green-50 border border-green-200' 
                                      : log.status === 'failed'
                                      ? 'bg-red-50 border border-red-200'
                                      : 'bg-yellow-50 border border-yellow-200'
                                  }`}
                                >
                                  <div className="flex items-center gap-2">
                                    {log.status === 'success' ? (
                                      <CheckCircle className="h-4 w-4 text-green-600" />
                                    ) : log.status === 'failed' ? (
                                      <XCircle className="h-4 w-4 text-red-600" />
                                    ) : (
                                      <Clock className="h-4 w-4 text-yellow-600" />
                                    )}
                                    <span className={
                                      log.status === 'success' ? 'text-green-800' 
                                      : log.status === 'failed' ? 'text-red-800' 
                                      : 'text-yellow-800'
                                    }>
                                      {log.status === 'success' 
                                        ? `Sent to ${log.recipient} (Low: ${log.lowStockCount}, Out: ${log.outOfStockCount})`
                                        : log.status === 'failed'
                                        ? `Failed: ${log.error}`
                                        : `Skipped: ${log.error}`
                                      }
                                    </span>
                                  </div>
                                  <span className="text-gray-500 text-xs">
                                    {new Date(log.timestamp).toLocaleString('en-IN')}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        </>
                      )}

                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                        <h4 className="font-medium text-blue-900 mb-2">Configuration Instructions</h4>
                        <p className="text-sm text-blue-800 mb-2">
                          To enable email sending, configure these environment variables:
                        </p>
                        <ul className="text-sm text-blue-700 list-disc list-inside space-y-1">
                          <li><code className="bg-blue-100 px-1 rounded">STOCK_ALERT_EMAIL</code> - Recipient email address</li>
                          <li><code className="bg-blue-100 px-1 rounded">DAILY_STOCK_ALERTS_ENABLED</code> - Set to "true" to enable</li>
                          <li><code className="bg-blue-100 px-1 rounded">SMTP_HOST</code> - SMTP server hostname</li>
                          <li><code className="bg-blue-100 px-1 rounded">SMTP_PORT</code> - SMTP port (default: 587)</li>
                          <li><code className="bg-blue-100 px-1 rounded">SMTP_USER</code> - SMTP username</li>
                          <li><code className="bg-blue-100 px-1 rounded">SMTP_PASS</code> - SMTP password</li>
                          <li><code className="bg-blue-100 px-1 rounded">SMTP_FROM</code> - From email address (optional)</li>
                        </ul>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <User className="h-5 w-5 text-blue-600" />
                  <CardTitle>User Profile</CardTitle>
                </div>
                <CardDescription>
                  Manage your personal information and preferences
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4">
                  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div className="space-y-1">
                      <Label className="text-base font-medium">Name</Label>
                      <p className="text-sm text-gray-500">Your display name</p>
                    </div>
                    <Badge variant="outline">
                      {user?.firstName} {user?.lastName}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div className="space-y-1">
                      <Label className="text-base font-medium">Email</Label>
                      <p className="text-sm text-gray-500">Your account email</p>
                    </div>
                    <Badge variant="outline" className="font-mono">
                      {user?.email || 'Not set'}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div className="space-y-1">
                      <Label className="text-base font-medium">Role</Label>
                      <p className="text-sm text-gray-500">Your access level</p>
                    </div>
                    <Badge className={
                      user?.role === 'admin' ? 'bg-purple-100 text-purple-800' :
                      user?.role === 'manager' ? 'bg-blue-100 text-blue-800' :
                      'bg-gray-100 text-gray-800'
                    }>
                      {user?.role ? user.role.charAt(0).toUpperCase() + user.role.slice(1) : 'Unknown'}
                    </Badge>
                  </div>
                </div>
                <p className="text-sm text-gray-500 mt-4">
                  Profile editing coming soon. Contact an administrator to update your information.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Palette className="h-5 w-5 text-blue-600" />
                  <CardTitle>System Preferences</CardTitle>
                </div>
                <CardDescription>
                  Customize your application experience
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4">
                  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div className="space-y-1">
                      <Label className="text-base font-medium">Theme</Label>
                      <p className="text-sm text-gray-500">Application appearance</p>
                    </div>
                    <Badge variant="outline">Light Mode</Badge>
                  </div>
                  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div className="space-y-1">
                      <Label className="text-base font-medium">Currency</Label>
                      <p className="text-sm text-gray-500">Default currency for prices</p>
                    </div>
                    <Badge variant="outline">₹ INR</Badge>
                  </div>
                  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div className="space-y-1">
                      <Label className="text-base font-medium">Timezone</Label>
                      <p className="text-sm text-gray-500">For scheduled tasks and reports</p>
                    </div>
                    <Badge variant="outline">Asia/Kolkata (IST)</Badge>
                  </div>
                </div>
                <p className="text-sm text-gray-500 mt-4">
                  Additional customization options coming soon.
                </p>
              </CardContent>
            </Card>

          </div>
        </main>
      </div>
    </div>
  );
}
