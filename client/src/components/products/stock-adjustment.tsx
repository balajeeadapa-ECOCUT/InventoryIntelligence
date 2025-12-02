import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { TrendingUp, TrendingDown, RotateCcw, CalendarIcon, FileText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

const stockAdjustmentSchema = z.object({
  productId: z.number(),
  type: z.enum(["IN", "OUT", "ADJUSTMENT"]),
  quantity: z.number().min(1, "Quantity must be at least 1"),
  reason: z.string().min(1, "Reason is required").max(100, "Reason must be less than 100 characters"),
  invoiceNumber: z.string().max(100, "Invoice number must be less than 100 characters").optional().nullable(),
  invoiceDate: z.date().optional().nullable(),
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
  const [showCustomReason, setShowCustomReason] = useState(false);
  const [customReasons, setCustomReasons] = useState<string[]>([]);

  // Load custom reasons from localStorage on component mount
  useEffect(() => {
    const savedReasons = localStorage.getItem('customStockReasons');
    if (savedReasons) {
      setCustomReasons(JSON.parse(savedReasons));
    }
  }, []);

  const form = useForm<StockAdjustmentData>({
    resolver: zodResolver(stockAdjustmentSchema),
    defaultValues: {
      productId: product?.id || 0,
      type: "IN",
      quantity: 1,
      reason: "",
      invoiceNumber: "",
      invoiceDate: null,
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
      setShowCustomReason(false);
    },
    onError: (error) => {
      toast({ 
        title: "Error", 
        description: error.message || "Failed to record stock adjustment",
        variant: "destructive"
      });
    },
  });

  const saveCustomReason = (reason: string) => {
    if (reason && !customReasons.includes(reason)) {
      const updatedReasons = [...customReasons, reason].slice(-10); // Keep last 10 custom reasons
      setCustomReasons(updatedReasons);
      localStorage.setItem('customStockReasons', JSON.stringify(updatedReasons));
    }
  };

  const onSubmit = (data: StockAdjustmentData) => {
    // Save custom reason if it's a new one
    if (showCustomReason && data.reason) {
      saveCustomReason(data.reason);
    }
    
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
      <DialogContent className="w-[95vw] max-w-md max-h-[95vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle>Adjust Stock - {product.name}</DialogTitle>
        </DialogHeader>

        <div className="flex-shrink-0 mb-4 p-3 bg-gray-50 rounded-lg">
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

        <div className="flex-1 overflow-y-auto min-h-0">
          <Form {...form}>
            <div className="space-y-4 pb-4">
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
                  <div className="space-y-2">
                    <Select onValueChange={(value) => {
                      if (value === "custom") {
                        setShowCustomReason(true);
                        field.onChange("");
                      } else {
                        setShowCustomReason(false);
                        field.onChange(value);
                      }
                    }} defaultValue={field.value}>
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
                        
                        {customReasons.length > 0 && (
                          <>
                            <div className="px-2 py-1 text-xs font-medium text-gray-500 border-t">
                              Recent Custom Reasons
                            </div>
                            {customReasons.map((reason, index) => (
                              <SelectItem key={`custom-${index}`} value={reason}>
                                {reason}
                              </SelectItem>
                            ))}
                          </>
                        )}
                        
                        <SelectItem value="custom">+ Add New Custom Reason</SelectItem>
                      </SelectContent>
                    </Select>
                    
                    {showCustomReason && (
                      <Input
                        placeholder="Enter custom reason (max 100 characters)..."
                        value={field.value}
                        onChange={field.onChange}
                        className="mt-2"
                        maxLength={100}
                      />
                    )}
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="invoiceNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-1">
                      <FileText className="h-3 w-3" />
                      Invoice/DC No.
                    </FormLabel>
                    <FormControl>
                      <Input
                        placeholder="INV-001 or DC-001"
                        {...field}
                        value={field.value || ""}
                        data-testid="input-invoice-number"
                      />
                    </FormControl>
                    <FormDescription className="text-xs">
                      For GST compliance
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="invoiceDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-1">
                      <CalendarIcon className="h-3 w-3" />
                      Invoice/DC Date
                    </FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            className={cn(
                              "w-full pl-3 text-left font-normal",
                              !field.value && "text-muted-foreground"
                            )}
                            data-testid="button-invoice-date"
                          >
                            {field.value ? (
                              format(field.value, "dd/MM/yyyy")
                            ) : (
                              <span>Pick date</span>
                            )}
                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={field.value || undefined}
                          onSelect={field.onChange}
                          disabled={(date) =>
                            date > new Date() || date < new Date("2020-01-01")
                          }
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                    <FormDescription className="text-xs">
                      Document date
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

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
                      data-testid="textarea-notes"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            </div>
          </Form>
        </div>

        <div className="flex-shrink-0 flex justify-end space-x-2 pt-4 border-t bg-white">
          <Button 
            type="button" 
            variant="outline" 
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button 
            disabled={stockAdjustmentMutation.isPending}
            onClick={form.handleSubmit(onSubmit)}
          >
            {stockAdjustmentMutation.isPending ? "Recording..." : "Record Movement"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}