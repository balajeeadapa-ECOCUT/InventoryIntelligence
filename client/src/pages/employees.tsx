import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Header } from "@/components/layout/header";
import { Sidebar } from "@/components/layout/sidebar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { UserCheck, UserX, Clock, Users, Trash2, Save } from "lucide-react";
import type { User } from "@shared/schema";

type UserRole = "admin" | "manager" | "sales_team";

export default function Employees() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [selectedRoles, setSelectedRoles] = useState<Record<string, UserRole>>({});
  const [pendingRoleChanges, setPendingRoleChanges] = useState<Record<string, UserRole>>({});
  const { toast } = useToast();

  const { data: pendingEmployees = [], isLoading: loadingPending } = useQuery<User[]>({
    queryKey: ["/api/pending-employees"],
  });

  const { data: allEmployees = [], isLoading: loadingAll } = useQuery<User[]>({
    queryKey: ["/api/employees"],
  });

  const approvedEmployees = allEmployees.filter(emp => emp.status === "approved");

  const approvalMutation = useMutation({
    mutationFn: async ({ id, status, role }: { id: string; status: "approved" | "rejected"; role?: UserRole }) => {
      await apiRequest("POST", `/api/approve-employee/${id}`, { status, role });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pending-employees"] });
      queryClient.invalidateQueries({ queryKey: ["/api/employees"] });
      toast({
        title: "Employee status updated",
        description: "The employee's access status has been updated successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateRoleMutation = useMutation({
    mutationFn: async ({ id, role }: { id: string; role: UserRole }) => {
      await apiRequest("PATCH", `/api/users/${id}/role`, { role });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/employees"] });
      setPendingRoleChanges(prev => {
        const updated = { ...prev };
        delete updated[variables.id];
        return updated;
      });
      toast({
        title: "Role updated",
        description: "Employee role has been updated successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/employees/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/employees"] });
      queryClient.invalidateQueries({ queryKey: ["/api/pending-employees"] });
      toast({
        title: "Employee removed",
        description: "The employee has been removed from the system.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleApproval = (id: string, status: "approved" | "rejected", existingRole?: string) => {
    const role = selectedRoles[id] || (existingRole as UserRole) || "sales_team";
    approvalMutation.mutate({ id, status, role: status === "approved" ? role : undefined });
  };

  const handleRoleChange = (userId: string, role: UserRole) => {
    setSelectedRoles(prev => ({ ...prev, [userId]: role }));
  };

  const handleApprovedRoleChange = (userId: string, role: UserRole) => {
    setPendingRoleChanges(prev => ({ ...prev, [userId]: role }));
  };

  const handleSaveRole = (userId: string) => {
    const newRole = pendingRoleChanges[userId];
    if (newRole) {
      updateRoleMutation.mutate({ id: userId, role: newRole });
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <Badge variant="outline" className="text-yellow-600 border-yellow-300"><Clock className="w-3 h-3 mr-1" />Pending</Badge>;
      case "approved":
        return <Badge variant="outline" className="text-green-600 border-green-300"><UserCheck className="w-3 h-3 mr-1" />Approved</Badge>;
      case "rejected":
        return <Badge variant="outline" className="text-red-600 border-red-300"><UserX className="w-3 h-3 mr-1" />Rejected</Badge>;
      default:
        return <Badge variant="outline">Unknown</Badge>;
    }
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case "admin":
        return <Badge className="bg-purple-600">Admin</Badge>;
      case "manager":
        return <Badge className="bg-blue-600">Manager</Badge>;
      case "sales_team":
        return <Badge className="bg-gray-600">Sales Team</Badge>;
      default:
        return <Badge variant="outline">{role}</Badge>;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      
      <div className={`transition-all duration-300 ${sidebarOpen ? 'ml-64' : 'ml-0'}`}>
        <Header
          title="Employee Management"
          subtitle="Manage employee access and roles"
          onMenuClick={() => setSidebarOpen(!sidebarOpen)}
        />

        <div className="p-6">
          <Tabs defaultValue="pending" className="space-y-4">
            <TabsList>
              <TabsTrigger value="pending" className="flex items-center gap-2">
                <Clock className="w-4 h-4" />
                Pending Approvals
                {pendingEmployees.length > 0 && (
                  <Badge variant="destructive" className="ml-1">{pendingEmployees.length}</Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="all" className="flex items-center gap-2">
                <Users className="w-4 h-4" />
                All Employees ({approvedEmployees.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="pending">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Clock className="h-5 w-5" />
                    Pending Employee Approvals
                  </CardTitle>
                  <CardDescription>
                    Review and approve employee access requests
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {loadingPending ? (
                    <div className="text-center py-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600 mx-auto"></div>
                      <p className="mt-2 text-gray-600">Loading pending employees...</p>
                    </div>
                  ) : pendingEmployees.length === 0 ? (
                    <div className="text-center py-8">
                      <UserCheck className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                      <p className="text-gray-600">No pending employee approvals</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {pendingEmployees.map((employee: User) => (
                        <div key={employee.id} className="flex items-center justify-between p-4 border rounded-lg bg-white">
                          <div className="flex items-center space-x-4">
                            {employee.profileImageUrl ? (
                              <img
                                src={employee.profileImageUrl}
                                alt={`${employee.firstName || 'Employee'} avatar`}
                                className="w-10 h-10 rounded-full object-cover"
                              />
                            ) : (
                              <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center">
                                <Users className="w-5 h-5 text-gray-400" />
                              </div>
                            )}
                            
                            <div>
                              <h3 className="font-medium">
                                {employee.firstName && employee.lastName 
                                  ? `${employee.firstName} ${employee.lastName}`
                                  : employee.email || 'Unknown Employee'
                                }
                              </h3>
                              <p className="text-sm text-gray-600">{employee.email}</p>
                              <div className="flex items-center gap-2 mt-1">
                                {getStatusBadge(employee.status)}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center space-x-3">
                            <div className="flex flex-col">
                              <span className="text-xs text-gray-500 mb-1">Assign Role</span>
                              <Select
                                value={selectedRoles[employee.id] || (employee.role as UserRole) || "sales_team"}
                                onValueChange={(value) => handleRoleChange(employee.id, value as UserRole)}
                              >
                                <SelectTrigger className="w-[140px]" data-testid={`select-role-pending-${employee.id}`}>
                                  <SelectValue placeholder="Select role" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="admin">Admin</SelectItem>
                                  <SelectItem value="manager">Manager</SelectItem>
                                  <SelectItem value="sales_team">Sales Team</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="flex space-x-2">
                              <Button
                                onClick={() => handleApproval(employee.id, "approved", employee.role)}
                                disabled={approvalMutation.isPending}
                                size="sm"
                                className="bg-green-600 hover:bg-green-700"
                                data-testid={`button-approve-${employee.id}`}
                              >
                                <UserCheck className="w-4 h-4 mr-1" />
                                Approve
                              </Button>
                              <Button
                                onClick={() => handleApproval(employee.id, "rejected", employee.role)}
                                disabled={approvalMutation.isPending}
                                size="sm"
                                variant="destructive"
                                data-testid={`button-reject-${employee.id}`}
                              >
                                <UserX className="w-4 h-4 mr-1" />
                                Reject
                              </Button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="all">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    All Employees
                  </CardTitle>
                  <CardDescription>
                    Manage existing employee roles and access
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {loadingAll ? (
                    <div className="text-center py-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600 mx-auto"></div>
                      <p className="mt-2 text-gray-600">Loading employees...</p>
                    </div>
                  ) : approvedEmployees.length === 0 ? (
                    <div className="text-center py-8">
                      <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                      <p className="text-gray-600">No employees found</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {approvedEmployees.map((employee: User) => (
                        <div key={employee.id} className="flex items-center justify-between p-4 border rounded-lg bg-white">
                          <div className="flex items-center space-x-4">
                            {employee.profileImageUrl ? (
                              <img
                                src={employee.profileImageUrl}
                                alt={`${employee.firstName || 'Employee'} avatar`}
                                className="w-10 h-10 rounded-full object-cover"
                              />
                            ) : (
                              <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center">
                                <Users className="w-5 h-5 text-gray-400" />
                              </div>
                            )}
                            
                            <div>
                              <h3 className="font-medium">
                                {employee.firstName && employee.lastName 
                                  ? `${employee.firstName} ${employee.lastName}`
                                  : employee.email || 'Unknown Employee'
                                }
                              </h3>
                              <p className="text-sm text-gray-600">{employee.email}</p>
                              <div className="flex items-center gap-2 mt-1">
                                {getStatusBadge(employee.status)}
                                {getRoleBadge(employee.role)}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center space-x-3">
                            <div className="flex flex-col">
                              <span className="text-xs text-gray-500 mb-1">Change Role</span>
                              <Select
                                value={pendingRoleChanges[employee.id] || (employee.role as UserRole)}
                                onValueChange={(value) => handleApprovedRoleChange(employee.id, value as UserRole)}
                              >
                                <SelectTrigger className="w-[140px]" data-testid={`select-role-${employee.id}`}>
                                  <SelectValue placeholder="Select role" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="admin">Admin</SelectItem>
                                  <SelectItem value="manager">Manager</SelectItem>
                                  <SelectItem value="sales_team">Sales Team</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="flex space-x-2">
                              <Button
                                onClick={() => handleSaveRole(employee.id)}
                                disabled={!pendingRoleChanges[employee.id] || updateRoleMutation.isPending}
                                size="sm"
                                className="bg-blue-600 hover:bg-blue-700"
                                data-testid={`button-save-role-${employee.id}`}
                              >
                                <Save className="w-4 h-4 mr-1" />
                                Save
                              </Button>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button
                                    size="sm"
                                    variant="destructive"
                                    data-testid={`button-delete-${employee.id}`}
                                  >
                                    <Trash2 className="w-4 h-4 mr-1" />
                                    Remove
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Remove Employee</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Are you sure you want to remove {employee.firstName && employee.lastName 
                                        ? `${employee.firstName} ${employee.lastName}` 
                                        : employee.email
                                      } from the system? This action cannot be undone.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={() => deleteMutation.mutate(employee.id)}
                                      className="bg-red-600 hover:bg-red-700"
                                      data-testid={`button-confirm-delete-${employee.id}`}
                                    >
                                      Remove Employee
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
