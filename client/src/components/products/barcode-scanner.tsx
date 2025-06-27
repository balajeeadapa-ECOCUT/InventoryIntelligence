import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { QrCode, Camera } from "lucide-react";

interface BarcodeScannerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onScan: (barcode: string) => void;
}

export function BarcodeScanner({ open, onOpenChange, onScan }: BarcodeScannerProps) {
  const [manualBarcode, setManualBarcode] = useState("");
  const [isScanning, setIsScanning] = useState(false);

  const handleManualSubmit = () => {
    if (manualBarcode.trim()) {
      onScan(manualBarcode.trim());
      setManualBarcode("");
      onOpenChange(false);
    }
  };

  const startCamera = () => {
    setIsScanning(true);
    // In a real implementation, you would use a barcode scanning library
    // like QuaggaJS or ZXing to access the camera and scan barcodes
    setTimeout(() => {
      // Simulate successful scan
      onScan("1234567890123");
      setIsScanning(false);
      onOpenChange(false);
    }, 3000);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <QrCode className="h-5 w-5" />
            <span>Barcode Scanner</span>
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          {/* Camera Scanner */}
          <div className="text-center">
            <div className="w-full h-48 bg-gray-100 rounded-lg flex items-center justify-center mb-4">
              {isScanning ? (
                <div className="text-center">
                  <div className="animate-pulse">
                    <Camera className="h-12 w-12 text-gray-400 mx-auto mb-2" />
                    <p className="text-sm text-gray-600">Scanning for barcode...</p>
                  </div>
                </div>
              ) : (
                <div className="text-center">
                  <QrCode className="h-12 w-12 text-gray-400 mx-auto mb-2" />
                  <p className="text-sm text-gray-600">Click to start camera</p>
                </div>
              )}
            </div>
            <Button 
              onClick={startCamera} 
              disabled={isScanning}
              className="w-full"
            >
              {isScanning ? "Scanning..." : "Start Camera"}
            </Button>
          </div>
          
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-white px-2 text-gray-500">Or</span>
            </div>
          </div>
          
          {/* Manual Entry */}
          <div className="space-y-4">
            <div>
              <Label htmlFor="manual-barcode">Enter Barcode Manually</Label>
              <Input
                id="manual-barcode"
                type="text"
                placeholder="123456789012"
                value={manualBarcode}
                onChange={(e) => setManualBarcode(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleManualSubmit()}
              />
            </div>
            <Button onClick={handleManualSubmit} variant="outline" className="w-full">
              Submit Barcode
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
