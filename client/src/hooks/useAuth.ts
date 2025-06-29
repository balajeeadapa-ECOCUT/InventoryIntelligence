import { useQuery } from "@tanstack/react-query";

export function useAuth() {
  const { data: user, isLoading, error } = useQuery({
    queryKey: ["/api/auth/user"],
    retry: false,
  });

  // Check if user is pending approval or rejected
  const isPendingApproval = error?.message?.includes("Account pending approval");
  const isRejected = error?.message?.includes("Account access denied");

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
    isPendingApproval,
    isRejected,
    approvalData: isPendingApproval && error?.response ? error.response : null,
  };
}
