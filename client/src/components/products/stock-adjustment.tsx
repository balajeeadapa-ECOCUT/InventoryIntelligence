import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { TrendingUp, TrendingDown, RotateCcw } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const stockAdjustmentSchema = z.object({
  productId: z.number(),
  type: z.enum(["IN", "OUT", "ADJUSTMENT"]),
  quantity: z.number().min(1, "Quantity must be at least 1"),
  reason: z.string().min(1, "Reason is required"),
  notes: z.string().optional(),
});

type StockAdjustmentData = z.infer<typeof stockAdjustmentSchema>;

interface StockAdjustmentProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: any;
}

export function StockAdjustment({ open, onOpenChange, product }: StockAdjustmentProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<StockAdjustmentData>({
    resolver: zodResolver(stockAdjustmentSchema),
    defaultValues: {
      productId: product?.id || 0,
      type: "IN",
      quantity: 1,
      reason: "",
      notes: "",
    },
  });

  const stockAdjustmentMutation = useMutation({
    mutationFn: async (data: StockAdjustmentData) => {
      return await apiRequest("POST", "/api/stock-movements", data);
    },
    onSuccess: () => {
      toast({ 
        title: "Success", 
        description: "Stock adjustment recorded successfully" 
      });
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stock-movements"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      onOpenChange(false);
      form.reset();
    },
    onError: (error) => {
      toast({ 
        title: "Error", 
        description: error.message || "Failed to record stock adjustment",
        variant: "destructive"
      });
    },
  });

  const onSubmit = (data: StockAdjustmentData) => {
    stockAdjustmentMutation.mutate({
      ...data,
      productId: product.id,
    });
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "IN":
        return <TrendingUp className="h-4 w-4" />;
      case "OUT":
        return <TrendingDown className="h-4 w-4" />;
      case "ADJUSTMENT":
        return <RotateCcw className="h-4 w-4" />;
      default:
        return null;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case "IN":
        return "bg-green-100 text-green-800";
      case "OUT":
        return "bg-red-100 text-red-800";
      case "ADJUSTMENT":
        return "bg-blue-100 text-blue-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  if (!product) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Adjust Stock - {product.name}</DialogTitle>
        </DialogHeader>

        <div className="mb-4 p-3 bg-gray-50 rounded-lg">
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-600">Current Stock:</span>
            <Badge variant="outline" className="font-mono">
              {product.currentStock} units
            </Badge>
          </div>
          <div className="flex justify-between items-center mt-1">
            <span className="text-sm text-gray-600">SKU:</span>
            <span className="text-sm font-mono">{product.sku}</span>
          </div>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Movement Type</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select movement type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="IN">
                        <div className="flex items-center space-x-2">
                          <TrendingUp className="h-4 w-4 text-green-600" />
                          <span>Stock Inward (Add)</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="OUT">
                        <div className="flex items-center space-x-2">
                          <TrendingDown className="h-4 w-4 text-red-600" />
                          <span>Stock Outward (Remove)</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="ADJUSTMENT">
                        <div className="flex items-center space-x-2">
                          <RotateCcw className="h-4 w-4 text-blue-600" />
                          <span>Adjustment (Correction)</span>
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="quantity"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Quantity</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min="1"
                      {...field}
                      onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="reason"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Reason</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select reason" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="Purchase">New Purchase</SelectItem>
                      <SelectItem value="Sale">Sale/Sold</SelectItem>
                      <SelectItem value="Return">Customer Return</SelectItem>
                      <SelectItem value="Damage">Damaged/Broken</SelectItem>
                      <SelectItem value="Lost">Lost/Missing</SelectItem>
                      <SelectItem value="Transfer">Transfer</SelectItem>
                      <SelectItem value="Audit">Stock Audit</SelectItem>
                      <SelectItem value="Correction">Data Correction</SelectItem>
                      <SelectItem value="Other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes (Optional)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Additional notes about this stock movement..."
                      className="resize-none"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end space-x-2 pt-4">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={stockAdjustmentMutation.isPending}
              >
                {stockAdjustmentMutation.isPending ? "Recording..." : "Record Movement"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}