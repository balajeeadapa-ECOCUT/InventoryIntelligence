import { useState, useRef } from "react";
import { useMutation } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { 
  FileText, 
  Upload, 
  Loader2, 
  CheckCircle2, 
  Package,
  DollarSign,
  Calendar,
  FileUp,
  AlertCircle
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface DocumentItem {
  name: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

interface DocumentExtraction {
  documentType: "invoice" | "purchase_order" | "delivery_note" | "unknown";
  vendor?: string;
  date?: string;
  items: DocumentItem[];
  totalAmount?: number;
  invoiceNumber?: string;
  confidence: number;
  rawText: string;
}

export function DocumentProcessor() {
  const [extraction, setExtraction] = useState<DocumentExtraction | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [fileName, setFileName] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("document", file);
      
      const response = await fetch("/api/ai/process-document", {
        method: "POST",
        body: formData,
        credentials: "include"
      });
      
      if (!response.ok) {
        throw new Error("Failed to process document");
      }
      
      return response.json();
    },
    onSuccess: (data) => {
      setExtraction(data);
    }
  });

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (file.type === "application/pdf") {
        setFileName(file.name);
        uploadMutation.mutate(file);
      }
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setFileName(file.name);
      uploadMutation.mutate(file);
    }
  };

  const getDocTypeColor = (type: string) => {
    switch (type) {
      case "invoice": return "bg-blue-500";
      case "purchase_order": return "bg-purple-500";
      case "delivery_note": return "bg-green-500";
      default: return "bg-gray-500";
    }
  };

  const getDocTypeLabel = (type: string) => {
    switch (type) {
      case "invoice": return "Invoice";
      case "purchase_order": return "Purchase Order";
      case "delivery_note": return "Delivery Note";
      default: return "Unknown Document";
    }
  };

  return (
    <Card className="border-0 shadow-lg overflow-hidden">
      <CardHeader className="bg-gradient-to-r from-orange-50 to-red-50 dark:from-gray-800 dark:to-gray-900 border-b">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-r from-orange-600 to-red-600 flex items-center justify-center">
            <FileText className="w-5 h-5 text-white" />
          </div>
          <div>
            <CardTitle className="text-lg">Smart Document Scanner</CardTitle>
            <p className="text-sm text-gray-500">AI extracts data from invoices & purchase orders</p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-6">
        {/* Upload area */}
        <div
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          className={`relative border-2 border-dashed rounded-xl p-8 transition-all ${
            dragActive 
              ? "border-orange-500 bg-orange-50 dark:bg-orange-900/20" 
              : "border-gray-300 dark:border-gray-700 hover:border-orange-400"
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf"
            onChange={handleFileSelect}
            className="hidden"
            data-testid="document-upload-input"
          />
          
          {uploadMutation.isPending ? (
            <div className="text-center">
              <Loader2 className="w-12 h-12 animate-spin text-orange-600 mx-auto mb-3" />
              <p className="text-gray-600 dark:text-gray-300 font-medium">Processing document...</p>
              <p className="text-sm text-gray-500">{fileName}</p>
            </div>
          ) : (
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-gradient-to-r from-orange-100 to-red-100 dark:from-orange-900/30 dark:to-red-900/30 flex items-center justify-center mx-auto mb-4">
                <FileUp className="w-8 h-8 text-orange-600" />
              </div>
              <p className="text-gray-700 dark:text-gray-300 font-medium mb-1">
                Drag & drop a PDF document
              </p>
              <p className="text-sm text-gray-500 mb-4">
                or click to browse your files
              </p>
              <Button
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                className="border-orange-300 text-orange-600 hover:bg-orange-50"
                data-testid="browse-files-btn"
              >
                <Upload className="w-4 h-4 mr-2" />
                Browse Files
              </Button>
            </div>
          )}
        </div>

        {/* Extraction results */}
        <AnimatePresence>
          {extraction && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-6 space-y-4"
              data-testid="extraction-results"
            >
              {/* Document info header */}
              <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-xl">
                <div className="flex items-center gap-3">
                  <Badge className={`${getDocTypeColor(extraction.documentType)} text-white`}>
                    {getDocTypeLabel(extraction.documentType)}
                  </Badge>
                  <span className="text-sm text-gray-500">
                    {extraction.invoiceNumber && `#${extraction.invoiceNumber}`}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-500">Confidence:</span>
                  <div className="flex items-center gap-2">
                    <Progress value={extraction.confidence * 100} className="w-20 h-2" />
                    <span className="text-sm font-medium">{Math.round(extraction.confidence * 100)}%</span>
                  </div>
                </div>
              </div>

              {/* Document metadata */}
              <div className="grid grid-cols-3 gap-4">
                {extraction.vendor && (
                  <div className="p-4 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
                    <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
                      <Package className="w-4 h-4" />
                      Vendor
                    </div>
                    <p className="font-medium text-gray-900 dark:text-white">{extraction.vendor}</p>
                  </div>
                )}
                {extraction.date && (
                  <div className="p-4 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
                    <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
                      <Calendar className="w-4 h-4" />
                      Date
                    </div>
                    <p className="font-medium text-gray-900 dark:text-white">{extraction.date}</p>
                  </div>
                )}
                {extraction.totalAmount && (
                  <div className="p-4 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
                    <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
                      <DollarSign className="w-4 h-4" />
                      Total Amount
                    </div>
                    <p className="font-medium text-green-600">₹{extraction.totalAmount.toLocaleString('en-IN')}</p>
                  </div>
                )}
              </div>

              {/* Extracted items */}
              {extraction.items.length > 0 && (
                <div className="rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                  <div className="px-4 py-3 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                    <h4 className="font-medium text-gray-900 dark:text-white flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-green-500" />
                      Extracted Items ({extraction.items.length})
                    </h4>
                  </div>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Item Name</TableHead>
                        <TableHead className="text-right">Quantity</TableHead>
                        <TableHead className="text-right">Unit Price</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {extraction.items.map((item, i) => (
                        <TableRow key={i}>
                          <TableCell className="font-medium">{item.name}</TableCell>
                          <TableCell className="text-right">{item.quantity}</TableCell>
                          <TableCell className="text-right">₹{item.unitPrice.toLocaleString('en-IN')}</TableCell>
                          <TableCell className="text-right font-medium">₹{item.total.toLocaleString('en-IN')}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}

              {extraction.items.length === 0 && (
                <div className="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-xl border border-amber-200 dark:border-amber-800">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0" />
                    <div>
                      <p className="font-medium text-amber-800 dark:text-amber-200">
                        No items could be extracted
                      </p>
                      <p className="text-sm text-amber-700 dark:text-amber-300">
                        The document format may not be supported or the text quality is too low.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </CardContent>
    </Card>
  );
}
