import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Upload, Download, FileSpreadsheet, AlertCircle, CheckCircle } from "lucide-react";

interface BulkUploadProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface UploadResult {
  successful: number;
  failed: number;
  errors: Array<{
    row: number;
    data: any;
    error: string;
  }>;
}

export function BulkUpload({ open, onOpenChange }: BulkUploadProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const downloadTemplateMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/products/template");
      if (!response.ok) {
        throw new Error("Failed to download template");
      }
      return response.blob();
    },
    onSuccess: (blob) => {
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "product-upload-template.xlsx";
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast({
        title: "Template Downloaded",
        description: "The Excel template has been downloaded successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Download Failed",
        description: "Failed to download the template. Please try again.",
        variant: "destructive",
      });
    },
  });

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/products/bulk-upload", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Upload failed");
      }

      return response.json();
    },
    onSuccess: (data) => {
      setUploadResult(data.results);
      
      // Invalidate products query to refresh the list
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });

      toast({
        title: "Upload Complete",
        description: `${data.results.successful} products added successfully. ${data.results.failed} failed.`,
        variant: data.results.failed > 0 ? "destructive" : "default",
      });
    },
    onError: (error) => {
      toast({
        title: "Upload Failed",
        description: error instanceof Error ? error.message : "Failed to upload file",
        variant: "destructive",
      });
    },
  });

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.type === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
          file.type === "application/vnd.ms-excel") {
        setSelectedFile(file);
        setUploadResult(null);
      } else {
        toast({
          title: "Invalid File Type",
          description: "Please select an Excel file (.xlsx or .xls)",
          variant: "destructive",
        });
      }
    }
  };

  const handleUpload = () => {
    if (selectedFile) {
      uploadMutation.mutate(selectedFile);
    }
  };

  const handleClose = () => {
    setSelectedFile(null);
    setUploadResult(null);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Bulk Upload Products
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Download Template Section */}
          <div className="border rounded-lg p-4 bg-gray-50">
            <h3 className="font-medium mb-2">Step 1: Download Template</h3>
            <p className="text-sm text-gray-600 mb-3">
              Download the Excel template to ensure your data is formatted correctly.
            </p>
            <Button
              variant="outline"
              onClick={() => downloadTemplateMutation.mutate()}
              disabled={downloadTemplateMutation.isPending}
              className="w-full sm:w-auto"
            >
              <Download className="h-4 w-4 mr-2" />
              {downloadTemplateMutation.isPending ? "Downloading..." : "Download Template"}
            </Button>
          </div>

          {/* Upload File Section */}
          <div className="border rounded-lg p-4">
            <h3 className="font-medium mb-2">Step 2: Upload Your File</h3>
            <p className="text-sm text-gray-600 mb-3">
              Select the Excel file containing your product data.
            </p>
            
            <div className="space-y-4">
              <div>
                <Label htmlFor="file-upload">Excel File</Label>
                <Input
                  id="file-upload"
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleFileChange}
                  className="mt-1"
                />
              </div>

              {selectedFile && (
                <Alert>
                  <CheckCircle className="h-4 w-4" />
                  <AlertDescription>
                    Selected: {selectedFile.name} ({(selectedFile.size / 1024).toFixed(1)} KB)
                  </AlertDescription>
                </Alert>
              )}

              <Button
                onClick={handleUpload}
                disabled={!selectedFile || uploadMutation.isPending}
                className="w-full"
              >
                <Upload className="h-4 w-4 mr-2" />
                {uploadMutation.isPending ? "Uploading..." : "Upload Products"}
              </Button>

              {uploadMutation.isPending && (
                <div className="space-y-2">
                  <Progress value={50} className="w-full" />
                  <p className="text-sm text-gray-600 text-center">Processing your file...</p>
                </div>
              )}
            </div>
          </div>

          {/* Results Section */}
          {uploadResult && (
            <div className="border rounded-lg p-4">
              <h3 className="font-medium mb-2">Upload Results</h3>
              
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="text-center p-3 bg-green-50 rounded-lg">
                  <div className="text-2xl font-bold text-green-600">{uploadResult.successful}</div>
                  <div className="text-sm text-green-700">Successful</div>
                </div>
                <div className="text-center p-3 bg-red-50 rounded-lg">
                  <div className="text-2xl font-bold text-red-600">{uploadResult.failed}</div>
                  <div className="text-sm text-red-700">Failed</div>
                </div>
              </div>

              {uploadResult.errors.length > 0 && (
                <div className="space-y-2">
                  <h4 className="font-medium text-red-600">Errors:</h4>
                  <div className="max-h-32 overflow-y-auto space-y-1">
                    {uploadResult.errors.slice(0, 5).map((error, index) => (
                      <Alert key={index} variant="destructive">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>
                          Row {error.row}: {error.error}
                        </AlertDescription>
                      </Alert>
                    ))}
                    {uploadResult.errors.length > 5 && (
                      <p className="text-sm text-gray-600">
                        And {uploadResult.errors.length - 5} more errors...
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Template Format Info */}
          <div className="text-xs text-gray-500 space-y-1">
            <p><strong>Required columns:</strong> Product Name, SKU, Unit Price</p>
            <p><strong>Optional columns:</strong> Description, Barcode, Category, Current Stock, Min Stock Level, Max Stock Level, Image URL</p>
            <p><strong>Supported formats:</strong> .xlsx, .xls (Max file size: 5MB)</p>
          </div>

          <div className="flex justify-end space-x-2">
            <Button variant="outline" onClick={handleClose}>
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}