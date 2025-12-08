import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { User } from "@shared/schema";

interface AuthResponse {
  user?: User;
  message?: string;
  status?: string;
}

export function useAuth() {
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery<User, Error>({
    queryKey: ["/api/auth/user"],
    retry: false,
    staleTime: 1000 * 60 * 5,
  });

  const errorMessage = error?.message || "";
  
  const isPendingApproval = errorMessage.includes("pending approval") || 
                            errorMessage.includes("403");
  const isRejected = errorMessage.includes("access denied") || 
                     errorMessage.includes("rejected");

  const logout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch (e) {
      // Fallback to Replit logout
    }
    queryClient.clear();
    window.location.href = "/login";
  };

  const refreshAuth = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
  };

  return {
    user: data as User | undefined,
    isLoading,
    isAuthenticated: !!data && !isPendingApproval && !isRejected,
    isPendingApproval,
    isRejected,
    logout,
    refreshAuth,
  };
}
