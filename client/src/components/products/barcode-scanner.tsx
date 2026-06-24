import { useState, useEffect, useRef, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { QrCode, Camera, CameraOff, Smartphone, AlertCircle, CheckCircle2 } from "lucide-react";

interface BarcodeScannerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onScan: (barcode: string) => void;
}

export function BarcodeScanner({ open, onOpenChange, onScan }: BarcodeScannerProps) {
  const [manualBarcode, setManualBarcode] = useState("");
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scannedValue, setScannedValue] = useState<string | null>(null);
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);
  const [selectedCamera, setSelectedCamera] = useState<string>("environment");
  const videoRef = useRef<HTMLVideoElement>(null);
  const readerRef = useRef<any>(null);
  const scanningRef = useRef(false);

  const loadZXing = useCallback(async () => {
    try {
      const { BrowserMultiFormatReader } = await import(
        /* @vite-ignore */ "https://esm.sh/@zxing/browser@0.1.5"
      );
      return BrowserMultiFormatReader;
    } catch {
      try {
        const mod = await import("@zxing/browser");
        return mod.BrowserMultiFormatReader;
      } catch {
        return null;
      }
    }
  }, []);

  const enumerateCameras = useCallback(async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter((d) => d.kind === "videoinput");
      setCameras(videoDevices);
      const backCam = videoDevices.find(
        (d) =>
          d.label.toLowerCase().includes("back") ||
          d.label.toLowerCase().includes("rear") ||
          d.label.toLowerCase().includes("environment")
      );
      if (backCam) setSelectedCamera(backCam.deviceId);
    } catch {}
  }, []);

  const stopScanning = useCallback(() => {
    scanningRef.current = false;
    if (readerRef.current) {
      try { readerRef.current.reset(); } catch {}
      readerRef.current = null;
    }
    setIsScanning(false);
  }, []);

  const startScanning = useCallback(async () => {
    setError(null);
    setScannedValue(null);
    setIsScanning(true);
    scanningRef.current = true;
    try {
      const BrowserMultiFormatReader = await loadZXing();
      if (!BrowserMultiFormatReader) {
        throw new Error("Could not load scanning library. Please use manual entry.");
      }
      const reader = new BrowserMultiFormatReader();
      readerRef.current = reader;
      // Use selectedCamera deviceId or undefined for environment-facing default
      const deviceId =
        cameras.length > 0 && selectedCamera !== "environment"
          ? selectedCamera
          : undefined;
      // decodeFromVideoDevice(deviceId, videoElement, callbackFn) — correct API for @zxing/browser
      await reader.decodeFromVideoDevice(
        deviceId,
        videoRef.current,
        (result: any, err: any) => {
          if (!scanningRef.current) return;
          if (result) {
            const text = result.getText();
            setScannedValue(text);
            scanningRef.current = false;
            setTimeout(() => {
              stopScanning();
              onScan(text);
              onOpenChange(false);
            }, 800);
          } else if (err && err?.name !== "NotFoundException") {
            setError("Scanning error: " + (err?.message || "Unknown error"));
            stopScanning();
          }
        }
      );
    } catch (err: any) {
      const msg =
        err?.name === "NotAllowedError"
          ? "Camera access denied. Please allow camera permission in your browser/phone settings, then try again."
          : err?.name === "NotFoundError"
          ? "No camera found on this device."
          : err?.message || "Could not access camera.";
      setError(msg);
      setIsScanning(false);
    }
  }, [cameras, selectedCamera, loadZXing, stopScanning, onScan, onOpenChange]);

  useEffect(() => {
    if (!open) {
      stopScanning();
      setError(null);
      setScannedValue(null);
      setManualBarcode("");
    } else {
      enumerateCameras();
    }
  }, [open, stopScanning, enumerateCameras]);

  useEffect(() => () => { stopScanning(); }, [stopScanning]);

  const handleManualSubmit = () => {
    if (manualBarcode.trim()) {
      onScan(manualBarcode.trim());
      setManualBarcode("");
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) stopScanning(); onOpenChange(v); }}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <QrCode className="h-5 w-5" />
            <span>Barcode / QR Scanner</span>
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-xs text-blue-600 bg-blue-50 rounded-md px-3 py-2">
            <Smartphone className="h-4 w-4 shrink-0" />
            <span>Point your phone's rear camera at any barcode or QR code to scan instantly</span>
          </div>
          <div className="relative w-full rounded-lg overflow-hidden bg-black" style={{ aspectRatio: "4/3" }}>
            <video ref={videoRef} className="w-full h-full object-cover" playsInline muted autoPlay />
            {isScanning && !scannedValue && (
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <div className="w-56 h-32 border-2 border-blue-400 rounded relative">
                  <span className="absolute -top-1 -left-1 w-5 h-5 border-t-4 border-l-4 border-blue-500 rounded-tl" />
                  <span className="absolute -top-1 -right-1 w-5 h-5 border-t-4 border-r-4 border-blue-500 rounded-tr" />
                  <span className="absolute -bottom-1 -left-1 w-5 h-5 border-b-4 border-l-4 border-blue-500 rounded-bl" />
                  <span className="absolute -bottom-1 -right-1 w-5 h-5 border-b-4 border-r-4 border-blue-500 rounded-br" />
                </div>
                <p className="mt-3 text-white text-xs bg-black/40 px-2 py-1 rounded">Align barcode within frame</p>
              </div>
            )}
            {!isScanning && !error && !scannedValue && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900">
                <QrCode className="h-14 w-14 text-gray-500 mb-2" />
                <p className="text-sm text-gray-400">Camera preview will appear here</p>
              </div>
            )}
            {error && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-red-950/80 px-4">
                <AlertCircle className="h-10 w-10 text-red-400 mb-2" />
                <p className="text-sm text-red-300 text-center">{error}</p>
              </div>
            )}
            {scannedValue && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-green-950/80">
                <CheckCircle2 className="h-12 w-12 text-green-400 mb-2" />
                <p className="text-sm font-semibold text-green-300">Scanned!</p>
                <p className="text-xs text-green-400 mt-1 font-mono px-2 text-center">{scannedValue}</p>
              </div>
            )}
          </div>
          {cameras.length > 1 && (
            <div className="flex items-center gap-2">
              <Label className="text-xs whitespace-nowrap">Camera:</Label>
              <select
                className="text-xs border rounded px-2 py-1 flex-1"
                value={selectedCamera}
                onChange={(e) => { setSelectedCamera(e.target.value); if (isScanning) stopScanning(); }}
              >
                {cameras.map((cam, i) => (
                  <option key={cam.deviceId} value={cam.deviceId}>{cam.label || `Camera ${i + 1}`}</option>
                ))}
              </select>
            </div>
          )}
          <Button
            onClick={isScanning ? stopScanning : startScanning}
            className={`w-full ${isScanning ? "bg-red-500 hover:bg-red-600" : ""}`}
            disabled={!!scannedValue}
          >
            {isScanning ? (
              <><CameraOff className="h-4 w-4 mr-2" />Stop Camera</>
            ) : (
              <><Camera className="h-4 w-4 mr-2" />Start Camera and Scan</>
            )}
          </Button>
          <div className="relative">
            <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-white px-2 text-gray-500">Or enter manually</span>
            </div>
          </div>
          <div className="space-y-3">
            <div>
              <Label htmlFor="manual-barcode">Barcode or QR Code value</Label>
              <Input
                id="manual-barcode"
                type="text"
                placeholder="123456789012"
                value={manualBarcode}
                onChange={(e) => setManualBarcode(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleManualSubmit()}
                autoComplete="off"
              />
            </div>
            <Button onClick={handleManualSubmit} variant="outline" className="w-full" disabled={!manualBarcode.trim()}>
              Submit Barcode
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
