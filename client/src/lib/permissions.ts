import { useQuery } from "@tanstack/react-query";
import { UserRole } from "@shared/schema";

export interface UserPermissions {
  canManageUsers: boolean;
  canManageProducts: boolean;
  canManageCategories: boolean;
  canManageEmployees: boolean;
  canViewReports: boolean;
  canViewAIInsights: boolean;
  canManageSettings: boolean;
  canViewPrices: boolean;
  canEditPrices: boolean;
  canViewSuppliers: boolean;
  canManageInventory: boolean;
  canViewStockAlerts: boolean;
  canExportData: boolean;
  canDeleteData: boolean;
  canViewAllData: boolean;
}

export interface UserWithPermissions {
  user: {
    id: string;
    email: string;
    firstName?: string;
    lastName?: string;
    role: UserRole;
  };
  permissions: UserPermissions;
}

// React hook to fetch and use user permissions
export function usePermissions() {
  return useQuery<UserWithPermissions>({
    queryKey: ["user-permissions"],
    queryFn: async () => {
      const response = await fetch("/api/user/permissions", {
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("Failed to fetch permissions");
      }

      return response.json();
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 1,
  });
}

// Helper function to check if user has a specific permission
export function hasPermission(
  permissions: UserPermissions | undefined,
  permission: keyof UserPermissions
): boolean {
  return permissions ? permissions[permission] : false;
}

// Helper function to check if user has specific role
export function hasRole(
  user: UserWithPermissions | undefined,
  ...roles: UserRole[]
): boolean {
  return user ? roles.includes(user.user.role) : false;
}

// Component wrapper for permission-based rendering
export function Can({
  permission,
  children,
  fallback = null,
}: {
  permission: keyof UserPermissions;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}) {
  const { data: permissionsData } = usePermissions();

  if (hasPermission(permissionsData?.permissions, permission)) {
    return <>{children}</>;
  }

  return <>{fallback}</>;
}

// Component wrapper for role-based rendering
export function HasRole({
  roles,
  children,
  fallback = null,
}: {
  roles: UserRole[];
  children: React.ReactNode;
  fallback?: React.ReactNode;
}) {
  const { data: permissionsData } = usePermissions();

  if (hasRole(permissionsData, ...roles)) {
    return <>{children}</>;
  }

  return <>{fallback}</>;
}