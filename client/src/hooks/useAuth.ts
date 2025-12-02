import { useQuery } from "@tanstack/react-query";
import type { User } from "@shared/schema";

interface AuthError extends Error {
  response?: {
    user?: User;
  };
}

export function useAuth() {
  const { data: user, isLoading, error } = useQuery<User>({
    queryKey: ["/api/auth/user"],
    retry: false,
  });

  const authError = error as AuthError | null;
  
  // Check if user is pending approval or rejected
  const isPendingApproval = authError?.message?.includes("Account pending approval");
  const isRejected = authError?.message?.includes("Account access denied");

  return {
    user: user as User | undefined,
    isLoading,
    isAuthenticated: !!user,
    isPendingApproval,
    isRejected,
    approvalData: isPendingApproval && authError?.response ? authError.response : null,
  };
}
