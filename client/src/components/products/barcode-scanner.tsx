import { useState, useEffect, useRef, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { QrCode, Camera, CameraOff, Smartphone, AlertCircle, CheckCircle2, RefreshCw } from "lucide-react";

interface BarcodeScannerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onScan: (barcode: string) => void;
}

// Helper: extracts a clean item code from a QR scan result.
// If the scan is JSON (e.g. from QR label printer), returns barcode > sku > name > id.
// Otherwise returns the raw string (plain barcode / plain text).
function extractItemCode(raw: string): string {
  const trimmed = raw.trim();
  try {
    const p = JSON.parse(trimmed);
    const barcode = String(p.barcode || "").trim();
    const sku = String(p.sku || "").trim();
    const name = String(p.name || "").trim();
    const id = p.id ? String(p.id) : "";
    return barcode || sku || name || id || trimmed;
  } catch {
    return trimmed;
  }
}

export function BarcodeScanner({ open, onOpenChange, onScan }: BarcodeScannerProps) {
  const [manualBarcode, setManualBarcode] = useState("");
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorDetail, setErrorDetail] = useState<string | null>(null);
  const [scannedValue, setScannedValue] = useState<string | null>(null);
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);
  const [selectedCamera, setSelectedCamera] = useState<string>("environment");
  const [permissionState, setPermissionState] = useState<"unknown" | "granted" | "denied">("unknown");
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

  // Request camera permission explicitly and enumerate cameras
  const requestPermissionAndEnumerate = useCallback(async () => {
    try {
      // Step 1: Explicitly request permission — this triggers the browser prompt on Android
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } }
      });
      setPermissionState("granted");
      // Stop this test stream immediately — ZXing will create its own
      stream.getTracks().forEach((t) => t.stop());

      // Step 2: Now enumerate — labels will be populated after permission
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
    } catch (err: any) {
      setPermissionState("denied");
      if (err?.name === "NotAllowedError" || err?.name === "PermissionDeniedError") {
        setError("Camera permission denied. Please tap the camera/lock icon in your browser address bar and allow camera access, then try again.");
      } else if (err?.name === "NotFoundError") {
        setError("No camera found on this device.");
      } else {
        setError("Could not access camera: " + (err?.message || err?.name || "Unknown error"));
      }
    }
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
    setErrorDetail(null);
    setScannedValue(null);
    setIsScanning(true);
    scanningRef.current = true;
    try {
      // If permission not yet granted, request it first
      if (permissionState !== "granted") {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } }
        });
        setPermissionState("granted");
        stream.getTracks().forEach((t) => t.stop());
      }

      const BrowserMultiFormatReader = await loadZXing();
      if (!BrowserMultiFormatReader) {
        throw new Error("Could not load scanning library. Please use manual entry.");
      }
      const reader = new BrowserMultiFormatReader();
      readerRef.current = reader;

      // Use back/environment camera — pass undefined to let ZXing auto-select
      const deviceId =
        cameras.length > 0 && selectedCamera && selectedCamera !== "environment"
          ? selectedCamera
          : undefined;

      // decodeFromVideoDevice handles camera stream + video element internally
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
              onScan(extractItemCode(text));
              onOpenChange(false);
            }, 800);
          } else if (err) {
            // NotFoundException is expected — means no barcode in frame yet, keep scanning
            if (err?.name !== "NotFoundException") {
              setErrorDetail(err?.name + ": " + err?.message);
              setError("Scanning error. Try repositioning the QR code or use manual entry.");
              stopScanning();
            }
          }
        }
      );
    } catch (err: any) {
      let msg: string;
      if (err?.name === "NotAllowedError" || err?.name === "PermissionDeniedError") {
        msg = "Camera permission denied. Tap the camera icon in your browser's address bar to allow access, then try again.";
      } else if (err?.name === "NotFoundError") {
        msg = "No camera found. Please use manual entry below.";
      } else if (err?.name === "NotReadableError" || err?.name === "TrackStartError") {
        msg = "Camera is in use by another app. Close other camera apps and try again.";
      } else if (err?.name === "OverconstrainedError") {
        msg = "Rear camera not available. Try selecting a different camera.";
      } else {
        msg = "Could not access camera: " + (err?.message || err?.name || "Unknown error");
      }
      setError(msg);
      setErrorDetail(err?.name || null);
      setIsScanning(false);
    }
  }, [cameras, selectedCamera, permissionState, loadZXing, stopScanning, onScan, onOpenChange]);

  // When dialog opens, auto-request camera permission
  useEffect(() => {
    if (open) {
      setError(null);
      setErrorDetail(null);
      requestPermissionAndEnumerate();
    } else {
      stopScanning();
      setError(null);
      setErrorDetail(null);
      setScannedValue(null);
      setManualBarcode("");
      setPermissionState("unknown");
    }
  }, [open]);

  useEffect(() => () => { stopScanning(); }, [stopScanning]);

  const handleManualSubmit = () => {
    if (manualBarcode.trim()) {
      onScan(extractItemCode(manualBarcode.trim()));
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
                <p className="text-sm text-gray-400">
                  {permissionState === "granted" ? "Press Start Camera to scan" : "Requesting camera permission..."}
                </p>
              </div>
            )}

            {error && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-red-950/80 px-4 gap-2">
                <AlertCircle className="h-10 w-10 text-red-400 mb-1 shrink-0" />
                <p className="text-sm text-red-300 text-center">{error}</p>
                {errorDetail && (
                  <p className="text-xs text-red-400/70 text-center font-mono">{errorDetail}</p>
                )}
                <button
                  onClick={() => { setError(null); setErrorDetail(null); requestPermissionAndEnumerate(); }}
                  className="mt-1 text-xs text-red-300 underline flex items-center gap-1"
                >
                  <RefreshCw className="h-3 w-3" /> Retry permission
                </button>
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
            disabled={!!scannedValue || permissionState === "denied"}
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
