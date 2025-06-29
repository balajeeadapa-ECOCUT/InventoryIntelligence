import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Menu, Search, Bell, QrCode, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useLocation } from "wouter";

interface HeaderProps {
  title: string;
  subtitle?: string;
  onMenuClick?: () => void;
  onScanClick?: () => void;
  onSearch?: (query: string) => void;
  searchQuery?: string;
}

export function Header({ title, subtitle, onMenuClick, onScanClick, onSearch, searchQuery: externalQuery }: HeaderProps) {
  const [searchQuery, setSearchQuery] = useState(externalQuery || "");
  const [location, setLocation] = useLocation();

  useEffect(() => {
    if (externalQuery !== undefined) {
      setSearchQuery(externalQuery);
    }
  }, [externalQuery]);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchQuery(value);
    onSearch?.(value);
  };

  const handleSearchKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && searchQuery.trim()) {
      // Navigate to products page with search query if not already there
      if (!location.startsWith('/products')) {
        setLocation(`/products?search=${encodeURIComponent(searchQuery.trim())}`);
      }
    }
  };

  const clearSearch = () => {
    setSearchQuery("");
    onSearch?.("");
  };

  return (
    <header className="bg-white shadow-sm border-b border-gray-200 p-4 lg:p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button
            variant="ghost"
            size="sm"
            className="lg:hidden"
            onClick={onMenuClick}
          >
            <Menu className="h-5 w-5" />
          </Button>
          <div>
            <h2 className="text-2xl font-bold text-gray-900">{title}</h2>
            {subtitle && <p className="text-gray-600">{subtitle}</p>}
          </div>
        </div>
        
        <div className="flex items-center space-x-4">
          {/* Global Search Bar */}
          <div className="relative hidden md:block">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              type="text"
              placeholder="Search products... (Press Enter to search)"
              className="pl-10 pr-8 w-80"
              value={searchQuery}
              onChange={handleSearchChange}
              onKeyPress={handleSearchKeyPress}
            />
            {searchQuery && (
              <Button
                variant="ghost"
                size="sm"
                className="absolute right-1 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0"
                onClick={clearSearch}
              >
                <X className="h-3 w-3" />
              </Button>
            )}
          </div>
          
          {/* Mobile Search Button */}
          <Button
            variant="ghost"
            size="sm"
            className="md:hidden"
            onClick={() => setLocation('/products')}
          >
            <Search className="h-5 w-5" />
          </Button>
          
          {/* Notifications */}
          <Button variant="ghost" size="sm" className="relative">
            <Bell className="h-5 w-5" />
            <Badge className="absolute -top-1 -right-1 h-5 w-5 rounded-full p-0 text-xs">
              3
            </Badge>
          </Button>
          
          {/* Barcode Scanner */}
          <Button
            className="bg-blue-600 hover:bg-blue-700"
            onClick={onScanClick}
          >
            <QrCode className="h-4 w-4 mr-2" />
            <span className="hidden sm:inline">Scan Item</span>
          </Button>
        </div>
      </div>
    </header>
  );
}
