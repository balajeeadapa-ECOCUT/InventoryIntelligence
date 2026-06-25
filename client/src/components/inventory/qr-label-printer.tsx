import { useState, useRef, useEffect } from "react";
import QRCode from "react-qr-code";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import {
  Printer,
  QrCode,
  Package,
  X,
  Check,
  Loader2,
} from "lucide-react";

interface Product {
  id: number;
  name: string;
  sku: string;
  barcode?: string | null;
  categoryId?: number | null;
  currentStock: number;
  price?: string | null;
}

interface QRLabelPrinterProps {
  products: Product[];
  open: boolean;
  onClose: () => void;
  singleProduct?: Product | null;
  initialSelectedIds?: number[];
}

export function QRLabelPrinter({ products, open, onClose, singleProduct, initialSelectedIds }: QRLabelPrinterProps) {
  const [selectedProducts, setSelectedProducts] = useState<number[]>([]);
  const [isPrinting, setIsPrinting] = useState(false);
  const [copiesPerLabel, setCopiesPerLabel] = useState(1);
  const [labelSize, setLabelSize] = useState<"2x2" | "3x2" | "4x2">("2x2");
  const [searchFilter, setSearchFilter] = useState("");
  const printRef = useRef<HTMLDivElement>(null);
  const prevOpen = useRef(false);

  // Initialize selected products when dialog opens
  useEffect(() => {
    if (open && !prevOpen.current) {
      if (singleProduct) {
        setSelectedProducts([singleProduct.id]);
      } else if (initialSelectedIds !== undefined) {
        setSelectedProducts([...initialSelectedIds]);
      }
    }
    prevOpen.current = open;
  }, [open, singleProduct, initialSelectedIds]);

  const productList = singleProduct ? [singleProduct] : products;
  const filteredList = searchFilter.trim()
    ? productList.filter(p =>
        p.name.toLowerCase().includes(searchFilter.toLowerCase()) ||
        p.sku.toLowerCase().includes(searchFilter.toLowerCase()) ||
        (p.barcode || "").toLowerCase().includes(searchFilter.toLowerCase())
      )
    : productList;

  const toggleProduct = (productId: number) => {
    setSelectedProducts(prev =>
      prev.includes(productId) ? prev.filter(id => id !== productId) : [...prev, productId]
    );
  };

  const selectAll = () => setSelectedProducts(filteredList.map(p => p.id));
  const deselectAll = () => setSelectedProducts([]);
  const selectAllProducts = () => setSelectedProducts(productList.map(p => p.id));

  const generateQRData = (product: Product): string => {
    return JSON.stringify({
      sku: product.sku,
      name: product.name,
      barcode: product.barcode || product.sku,
      id: product.id,
    });
  };

  const getLabelDimensions = () => {
    switch (labelSize) {
      case "3x2": return { w: "3in", h: "2in", qr: "1.2in", qrPx: 115 };
      case "4x2": return { w: "4in", h: "2in", qr: "1.3in", qrPx: 125 };
      default: return { w: "2in", h: "2in", qr: "1in", qrPx: 96 };
    }
  };

  const handlePrint = () => {
    setIsPrinting(true);
    const selectedProductsData = productList.filter(p => selectedProducts.includes(p.id));
    const dim = getLabelDimensions();
    const labelsWithCopies = selectedProductsData.flatMap(p => Array(copiesPerLabel).fill(p));

    const printWindow = window.open('', '_blank');
    if (!printWindow) { setIsPrinting(false); return; }

    printWindow.document.write(`<!DOCTYPE html>
<html><head><title>QR Labels – EcoCut Inventory</title>
<style>
* { margin:0; padding:0; box-sizing:border-box; }
@page { size: auto; margin: 0.2in; }
body { font-family: Arial, sans-serif; background: white; print-color-adjust: exact; -webkit-print-color-adjust: exact; }
.labels-container { display: flex; flex-wrap: wrap; gap: 0.15in; justify-content: flex-start; }
.label { width: ${dim.w}; height: ${dim.h}; border: 1px solid #333; border-radius: 3px; padding: 0.06in; display: flex; flex-direction: column; align-items: center; justify-content: space-between; page-break-inside: avoid; background: white; }
.label-header { width:100%; text-align:center; border-bottom:1px solid #ccc; padding-bottom:3px; margin-bottom:3px; }
.company { font-size:7pt; font-weight:bold; color:#1d4ed8; letter-spacing:0.5px; }
.product-name { font-size:8pt; font-weight:bold; text-align:center; line-height:1.2; max-height:0.35in; overflow:hidden; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; }
.qr-container { flex:1; display:flex; align-items:center; justify-content:center; }
.label-footer { width:100%; text-align:center; border-top:1px solid #ccc; padding-top:3px; }
.sku { font-size:9pt; font-weight:bold; font-family:'Courier New',monospace; }
.barcode { font-size:6pt; color:#555; font-family:'Courier New',monospace; }
</style></head>
<body><div class="labels-container">
${labelsWithCopies.map((product: any, i: number) => `
<div class="label">
  <div class="label-header"><div class="company">ECOCUT INVENTORY</div></div>
  <div class="product-name">${product.name}</div>
  <div class="qr-container"><div id="qr-${product.id}-${i}"></div></div>
  <div class="label-footer">
    <div class="sku">${product.sku}</div>
    <div class="barcode">${product.barcode || product.sku}</div>
  </div>
</div>`).join('')}
</div>
<script src="https://cdn.jsdelivr.net/npm/qrcode@1.5.3/build/qrcode.min.js"></script>
<script>
document.addEventListener('DOMContentLoaded', function() {
  var items = ${JSON.stringify(labelsWithCopies.map((p: any, i: number) => ({ id: p.id, data: generateQRData(p), idx: i })))};
  var pending = items.length;
  items.forEach(function(item) {
    QRCode.toCanvas(document.createElement('canvas'), item.data, { width: ${dim.qrPx}, margin: 1 }, function(err, canvas) {
      if (!err) { document.getElementById('qr-' + item.id + '-' + item.idx)?.appendChild(canvas); }
      pending--;
      if (pending === 0) { setTimeout(function() { window.print(); window.close(); }, 300); }
    });
  });
  if (pending === 0) { setTimeout(function() { window.print(); window.close(); }, 300); }
});
</script></body></html>`);
    printWindow.document.close();
    setIsPrinting(false);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl max-h-[92vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <QrCode className="w-5 h-5 text-blue-600" />
            Print QR Labels
            {selectedProducts.length > 0 && (
              <Badge className="ml-2 bg-blue-100 text-blue-700">
                {selectedProducts.length * copiesPerLabel} label{selectedProducts.length * copiesPerLabel !== 1 ? "s" : ""} ready
              </Badge>
            )}
          </DialogTitle>
          <DialogDescription>
            Select products and configure label settings. Labels will open in a print dialog.
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-4 flex-1 min-h-0 mt-3">
          {/* Left: Product Selection */}
          {!singleProduct && (
            <div className="w-[45%] flex flex-col border-r pr-4">
              {/* Search + Select All */}
              <div className="flex gap-2 mb-2">
                <input
                  type="text"
                  placeholder="Search products..."
                  value={searchFilter}
                  onChange={e => setSearchFilter(e.target.value)}
                  className="flex-1 text-sm border rounded px-2 py-1 outline-none focus:ring-1 focus:ring-blue-300"
                />
              </div>
              <div className="flex gap-2 mb-2 flex-wrap">
                <Button variant="outline" size="sm" onClick={selectAll} className="text-xs h-7">
                  <Check className="w-3 h-3 mr-1" /> Select Visible ({filteredList.length})
                </Button>
                <Button variant="outline" size="sm" onClick={selectAllProducts} className="text-xs h-7 bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100">
                  <Check className="w-3 h-3 mr-1" /> All ({productList.length})
                </Button>
                <Button variant="outline" size="sm" onClick={deselectAll} className="text-xs h-7">
                  <X className="w-3 h-3 mr-1" /> Clear
                </Button>
              </div>
              <ScrollArea className="flex-1">
                <div className="space-y-1">
                  {filteredList.map((product) => (
                    <div
                      key={product.id}
                      className={`flex items-center gap-2 p-2 rounded border cursor-pointer transition-all text-sm ${
                        selectedProducts.includes(product.id)
                          ? "bg-blue-50 border-blue-300"
                          : "hover:bg-gray-50 border-transparent"
                      }`}
                      onClick={() => toggleProduct(product.id)}
                    >
                      <Checkbox
                        checked={selectedProducts.includes(product.id)}
                        onCheckedChange={() => toggleProduct(product.id)}
                        onClick={e => e.stopPropagation()}
                      />
                      <Package className="w-3 h-3 text-gray-400 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-xs truncate">{product.name}</p>
                        <p className="text-[10px] text-gray-400">{product.sku}</p>
                      </div>
                      <span className="text-[10px] text-gray-500 shrink-0">{product.currentStock} stk</span>
                    </div>
                  ))}
                </div>
              </ScrollArea>
              <div className="pt-2 border-t mt-2 text-xs text-gray-500">
                <span className="font-semibold text-blue-600">{selectedProducts.length}</span> selected · {filteredList.length} shown · {productList.length} total
              </div>
            </div>
          )}

          {/* Right: Settings + Preview */}
          <div className={`flex flex-col ${singleProduct ? "w-full" : "w-[55%]"}`}>
            {/* Print Settings */}
            <div className="grid grid-cols-2 gap-3 mb-3 p-3 bg-gray-50 rounded-lg border">
              <div>
                <label className="text-xs font-semibold text-gray-600 block mb-1">Copies per label</label>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" className="h-7 w-7 p-0" onClick={() => setCopiesPerLabel(c => Math.max(1, c - 1))}>−</Button>
                  <span className="text-sm font-bold w-6 text-center">{copiesPerLabel}</span>
                  <Button variant="outline" size="sm" className="h-7 w-7 p-0" onClick={() => setCopiesPerLabel(c => Math.min(10, c + 1))}>+</Button>
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 block mb-1">Label size</label>
                <div className="flex gap-1">
                  {(["2x2", "3x2", "4x2"] as const).map(s => (
                    <button
                      key={s}
                      onClick={() => setLabelSize(s)}
                      className={`text-xs px-2 py-1 rounded border transition-all ${labelSize === s ? "bg-blue-600 text-white border-blue-600" : "border-gray-300 hover:border-blue-300"}`}
                    >{s}"</button>
                  ))}
                </div>
              </div>
            </div>

            {/* Preview */}
            <div className="text-xs font-semibold text-gray-600 mb-1">Preview (first 6)</div>
            <div className="bg-gray-100 rounded-lg p-3 flex-1 flex items-start justify-center overflow-auto min-h-[200px]">
              {selectedProducts.length > 0 ? (
                <div className="flex flex-wrap gap-3 justify-center">
                  {productList
                    .filter(p => selectedProducts.includes(p.id))
                    .slice(0, 6)
                    .map((product) => (
                      <div
                        key={product.id}
                        className="bg-white rounded border-2 border-gray-300 p-1.5 flex flex-col items-center justify-between shadow-sm"
                        style={{ width: labelSize === "2x2" ? "5rem" : labelSize === "3x2" ? "6.5rem" : "8rem", height: "5rem" }}
                      >
                        <div className="w-full text-center border-b border-gray-100 pb-0.5">
                          <p className="text-[5px] font-bold text-blue-600 tracking-wide">ECOCUT</p>
                        </div>
                        <p className="text-[6px] font-semibold text-center line-clamp-2 px-0.5 leading-tight">
                          {product.name.length > 20 ? product.name.substring(0, 20) + "…" : product.name}
                        </p>
                        <div className="flex-1 flex items-center justify-center py-0.5">
                          <QRCode value={generateQRData(product)} size={36} level="M" />
                        </div>
                        <div className="w-full text-center border-t border-gray-100 pt-0.5">
                          <p className="text-[6px] font-bold font-mono truncate">{product.sku}</p>
                        </div>
                      </div>
                    ))}
                  {selectedProducts.length > 6 && (
                    <div className="w-20 h-20 bg-gray-200 rounded border-2 border-dashed border-gray-400 flex items-center justify-center">
                      <p className="text-xs text-gray-500 font-medium text-center">+{selectedProducts.length - 6}<br/>more</p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center text-gray-400 self-center">
                  <QrCode className="w-10 h-10 mx-auto mb-2 opacity-20" />
                  <p className="text-xs">Select products to preview</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex justify-between items-center pt-3 border-t mt-3">
          <Button variant="outline" onClick={onClose} size="sm">Cancel</Button>
          <div className="flex items-center gap-3">
            {selectedProducts.length > 0 && (
              <span className="text-xs text-gray-500">
                {selectedProducts.length} product{selectedProducts.length !== 1 ? "s" : ""} × {copiesPerLabel} cop{copiesPerLabel !== 1 ? "ies" : "y"} = {selectedProducts.length * copiesPerLabel} label{selectedProducts.length * copiesPerLabel !== 1 ? "s" : ""}
              </span>
            )}
            <Button
              onClick={handlePrint}
              disabled={selectedProducts.length === 0 || isPrinting}
              className="bg-blue-600 hover:bg-blue-700"
              data-testid="print-labels-btn"
            >
              {isPrinting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Printer className="w-4 h-4 mr-2" />}
              Print {selectedProducts.length > 0 ? `${selectedProducts.length * copiesPerLabel} Label${selectedProducts.length * copiesPerLabel !== 1 ? "s" : ""}` : "Labels"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Single label print button component
interface PrintQRButtonProps {
  product: Product;
  variant?: "default" | "outline" | "ghost" | "destructive" | "secondary" | "link";
  size?: "default" | "sm" | "lg" | "icon";
}

export function PrintQRButton({ product, variant = "outline", size = "sm" }: PrintQRButtonProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <Button
        variant={variant}
        size={size}
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(true);
        }}
        title="Print QR Label"
        data-testid={`print-qr-btn-${product.id}`}
      >
        <QrCode className={size === "icon" ? "w-4 h-4" : "w-4 h-4 mr-1"} />
        {size !== "icon" && "QR Label"}
      </Button>
      <QRLabelPrinter
        products={[product]}
        open={isOpen}
        onClose={() => setIsOpen(false)}
        singleProduct={product}
      />
    </>
  );
}
