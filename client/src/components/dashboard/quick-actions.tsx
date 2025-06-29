import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Upload, FileText, Shield } from "lucide-react";
import { useLocation } from "wouter";

interface QuickActionsProps {
  onAddProduct?: () => void;
  onScanItem?: () => void;
  onBulkUpload?: () => void;
}

export function QuickActions({ onAddProduct, onScanItem, onBulkUpload }: QuickActionsProps) {
  const [, setLocation] = useLocation();

  const actions = [
    {
      title: "Add Product",
      description: "Create new inventory item",
      icon: Plus,
      onClick: onAddProduct || (() => setLocation("/products?action=add")),
    },
    {
      title: "Bulk Upload",
      description: "Import from Excel",
      icon: Upload,
      onClick: onBulkUpload || (() => setLocation("/products?action=bulk")),
    },
    {
      title: "Generate Report",
      description: "Export inventory data",
      icon: FileText,
      onClick: () => setLocation("/reports"),
    },
    {
      title: "Manage Access",
      description: "Employee permissions",
      icon: Shield,
      onClick: () => setLocation("/employees"),
    },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Quick Actions</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4">
          {actions.map((action, index) => (
            <Button
              key={index}
              variant="outline"
              className="h-auto p-4 border-2 border-dashed hover:border-blue-600 hover:bg-blue-50 group"
              onClick={action.onClick}
            >
              <div className="text-center">
                <action.icon className="h-8 w-8 text-gray-400 group-hover:text-blue-600 mb-2 mx-auto" />
                <p className="font-medium text-gray-900">{action.title}</p>
                <p className="text-sm text-gray-600">{action.description}</p>
              </div>
            </Button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
