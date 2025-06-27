import { Link, useLocation } from "wouter";
import { Package, LayoutDashboard, Package2, Users, FileText, Settings, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/hooks/useAuth";

const navigation = [
  { name: "Dashboard", href: "/", icon: LayoutDashboard },
  { name: "Products", href: "/products", icon: Package2 },
  { name: "Employees", href: "/employees", icon: Users },
  { name: "Reports", href: "/reports", icon: FileText },
  { name: "Settings", href: "/settings", icon: Settings },
];

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export function Sidebar({ isOpen = true, onClose }: SidebarProps) {
  const [location] = useLocation();
  const { user } = useAuth();

  return (
    <div className={`w-64 bg-white shadow-lg flex-shrink-0 ${isOpen ? "block" : "hidden"} lg:block`}>
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
            <Package className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">StockFlow</h1>
            <p className="text-sm text-gray-600">Inventory Management</p>
          </div>
        </div>
      </div>
      
      <nav className="p-4 space-y-2">
        {navigation.map((item) => {
          const isActive = location === item.href;
          return (
            <Link key={item.name} href={item.href}>
              <a
                className={`flex items-center space-x-3 p-3 rounded-lg transition-colors ${
                  isActive
                    ? "bg-blue-50 text-blue-600 font-medium"
                    : "text-gray-600 hover:bg-gray-100"
                }`}
                onClick={onClose}
              >
                <item.icon className="h-5 w-5" />
                <span>{item.name}</span>
              </a>
            </Link>
          );
        })}
      </nav>
      
      <div className="absolute bottom-0 left-0 w-64 p-4 border-t border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Avatar className="h-10 w-10">
              <AvatarImage src={user?.profileImageUrl || undefined} />
              <AvatarFallback>
                {user?.firstName?.[0]}{user?.lastName?.[0]}
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="font-medium text-gray-900">
                {user?.firstName} {user?.lastName}
              </p>
              <p className="text-sm text-gray-600 capitalize">{user?.role}</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => window.location.href = "/api/logout"}
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
