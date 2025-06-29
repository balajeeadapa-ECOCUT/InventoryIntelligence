import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Header } from "@/components/layout/header";
import { Sidebar } from "@/components/layout/sidebar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { UserCheck, UserX, Clock, Users } from "lucide-react";
import type { User } from "@shared/schema";

export default function Employees() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { toast } = useToast();

  const { data: pendingEmployees = [], isLoading } = useQuery({
    queryKey: ["/api/pending-employees"],
  });

  const approvalMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "approved" | "rejected" }) => {
      await apiRequest(`/api/approve-employee/${id}`, {
        method: "POST",
        body: JSON.stringify({ status }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pending-employees"] });
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

  const handleApproval = (id: string, status: "approved" | "rejected") => {
    approvalMutation.mutate({ id, status });
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

  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      
      <div className={`transition-all duration-300 ${sidebarOpen ? 'ml-64' : 'ml-0'}`}>
        <Header
          title="Employee Management"
          subtitle="Approve or reject employee access requests"
          onMenuClick={() => setSidebarOpen(!sidebarOpen)}
        />

        <div className="p-6">
          <div className="mb-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Pending Employee Approvals
                </CardTitle>
                <CardDescription>
                  Review and approve employee access requests
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
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
                              <Badge variant="outline" className="text-blue-600 border-blue-300">
                                {employee.role}
                              </Badge>
                            </div>
                          </div>
                        </div>

                        <div className="flex space-x-2">
                          <Button
                            onClick={() => handleApproval(employee.id, "approved")}
                            disabled={approvalMutation.isPending}
                            size="sm"
                            className="bg-green-600 hover:bg-green-700"
                          >
                            <UserCheck className="w-4 h-4 mr-1" />
                            Approve
                          </Button>
                          <Button
                            onClick={() => handleApproval(employee.id, "rejected")}
                            disabled={approvalMutation.isPending}
                            size="sm"
                            variant="destructive"
                          >
                            <UserX className="w-4 h-4 mr-1" />
                            Reject
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}