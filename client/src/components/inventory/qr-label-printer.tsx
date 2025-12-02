import { useState, useRef } from "react";
import QRCode from "react-qr-code";
import { motion, AnimatePresence } from "framer-motion";
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
  Download,
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
}

export function QRLabelPrinter({ products, open, onClose, singleProduct }: QRLabelPrinterProps) {
  const [selectedProducts, setSelectedProducts] = useState<number[]>(
    singleProduct ? [singleProduct.id] : []
  );
  const [isPrinting, setIsPrinting] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  const toggleProduct = (productId: number) => {
    setSelectedProducts(prev =>
      prev.includes(productId)
        ? prev.filter(id => id !== productId)
        : [...prev, productId]
    );
  };

  const selectAll = () => {
    setSelectedProducts(products.map(p => p.id));
  };

  const deselectAll = () => {
    setSelectedProducts([]);
  };

  const generateQRData = (product: Product): string => {
    const data = {
      sku: product.sku,
      name: product.name,
      barcode: product.barcode || product.sku,
      id: product.id,
    };
    return JSON.stringify(data);
  };

  const handlePrint = () => {
    setIsPrinting(true);
    
    const printContent = printRef.current;
    if (!printContent) {
      setIsPrinting(false);
      return;
    }

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      setIsPrinting(false);
      return;
    }

    const selectedProductsData = products.filter(p => selectedProducts.includes(p.id));

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>EcoCut Inventory Labels</title>
          <style>
            * {
              margin: 0;
              padding: 0;
              box-sizing: border-box;
            }
            
            @page {
              size: auto;
              margin: 0.25in;
            }
            
            body {
              font-family: 'Arial', sans-serif;
              background: white;
              print-color-adjust: exact;
              -webkit-print-color-adjust: exact;
            }
            
            .labels-container {
              display: flex;
              flex-wrap: wrap;
              gap: 0.25in;
              justify-content: flex-start;
            }
            
            .label {
              width: 2in;
              height: 2in;
              border: 1px solid #000;
              border-radius: 4px;
              padding: 0.1in;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: space-between;
              page-break-inside: avoid;
              background: white;
            }
            
            .label-header {
              width: 100%;
              text-align: center;
              border-bottom: 1px solid #ccc;
              padding-bottom: 0.05in;
              margin-bottom: 0.05in;
            }
            
            .company-name {
              font-size: 8pt;
              font-weight: bold;
              color: #2563eb;
              letter-spacing: 0.5px;
            }
            
            .product-name {
              font-size: 9pt;
              font-weight: bold;
              text-align: center;
              line-height: 1.2;
              max-height: 0.4in;
              overflow: hidden;
              display: -webkit-box;
              -webkit-line-clamp: 2;
              -webkit-box-orient: vertical;
            }
            
            .qr-container {
              flex: 1;
              display: flex;
              align-items: center;
              justify-content: center;
              padding: 0.05in;
            }
            
            .qr-code {
              width: 1in !important;
              height: 1in !important;
            }
            
            .label-footer {
              width: 100%;
              text-align: center;
              border-top: 1px solid #ccc;
              padding-top: 0.05in;
            }
            
            .sku-text {
              font-size: 10pt;
              font-weight: bold;
              font-family: 'Courier New', monospace;
            }
            
            .barcode-text {
              font-size: 7pt;
              color: #666;
              font-family: 'Courier New', monospace;
            }
            
            @media print {
              .label {
                border: 1px solid #000 !important;
              }
              
              .no-print {
                display: none !important;
              }
            }
          </style>
        </head>
        <body>
          <div class="labels-container">
            ${selectedProductsData.map(product => `
              <div class="label">
                <div class="label-header">
                  <div class="company-name">ECOCUT INVENTORY</div>
                </div>
                <div class="product-name">${product.name}</div>
                <div class="qr-container">
                  <div id="qr-${product.id}"></div>
                </div>
                <div class="label-footer">
                  <div class="sku-text">${product.sku}</div>
                  <div class="barcode-text">${product.barcode || product.sku}</div>
                </div>
              </div>
            `).join('')}
          </div>
          <script src="https://cdn.jsdelivr.net/npm/qrcode@1.5.3/build/qrcode.min.js"></script>
          <script>
            document.addEventListener('DOMContentLoaded', function() {
              ${selectedProductsData.map(product => `
                QRCode.toCanvas(document.createElement('canvas'), '${generateQRData(product).replace(/'/g, "\\'")}', {
                  width: 96,
                  margin: 1,
                  color: { dark: '#000000', light: '#ffffff' }
                }, function(error, canvas) {
                  if (!error) {
                    canvas.className = 'qr-code';
                    canvas.style.width = '1in';
                    canvas.style.height = '1in';
                    document.getElementById('qr-${product.id}').appendChild(canvas);
                  }
                });
              `).join('')}
              
              setTimeout(function() {
                window.print();
                window.close();
              }, 500);
            });
          </script>
        </body>
      </html>
    `);
    
    printWindow.document.close();
    setIsPrinting(false);
  };

  const productList = singleProduct ? [singleProduct] : products;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <QrCode className="w-5 h-5 text-blue-600" />
            Print QR Labels
          </DialogTitle>
          <DialogDescription>
            Generate and print QR code labels for inventory items. Labels are 2x2 inches, suitable for warehouse tagging.
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-6 mt-4">
          {/* Product Selection */}
          {!singleProduct && (
            <div className="w-1/2 border-r pr-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-sm">Select Products</h3>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={selectAll}
                    data-testid="select-all-btn"
                  >
                    <Check className="w-3 h-3 mr-1" />
                    All
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={deselectAll}
                    data-testid="deselect-all-btn"
                  >
                    <X className="w-3 h-3 mr-1" />
                    None
                  </Button>
                </div>
              </div>
              <ScrollArea className="h-80">
                <div className="space-y-2">
                  {productList.map((product) => (
                    <motion.div
                      key={product.id}
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                        selectedProducts.includes(product.id)
                          ? "bg-blue-50 border-blue-300 dark:bg-blue-900/20"
                          : "hover:bg-gray-50 dark:hover:bg-gray-800"
                      }`}
                      onClick={() => toggleProduct(product.id)}
                      data-testid={`product-select-${product.id}`}
                    >
                      <Checkbox
                        checked={selectedProducts.includes(product.id)}
                        onCheckedChange={() => toggleProduct(product.id)}
                      />
                      <Package className="w-4 h-4 text-gray-500" />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{product.name}</p>
                        <p className="text-xs text-gray-500">SKU: {product.sku}</p>
                      </div>
                      <Badge variant="outline" className="text-xs">
                        {product.currentStock} in stock
                      </Badge>
                    </motion.div>
                  ))}
                </div>
              </ScrollArea>
              <div className="mt-3 pt-3 border-t">
                <p className="text-sm text-gray-600">
                  <span className="font-semibold">{selectedProducts.length}</span> items selected
                </p>
              </div>
            </div>
          )}

          {/* Preview */}
          <div className={singleProduct ? "w-full" : "w-1/2"}>
            <h3 className="font-semibold text-sm mb-3">Label Preview</h3>
            <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-4 flex items-center justify-center min-h-[280px]">
              {selectedProducts.length > 0 ? (
                <div ref={printRef} className="flex flex-wrap gap-4 justify-center">
                  <AnimatePresence>
                    {productList
                      .filter(p => selectedProducts.includes(p.id))
                      .slice(0, 4)
                      .map((product) => (
                        <motion.div
                          key={product.id}
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.9 }}
                          className="w-32 h-32 bg-white rounded border-2 border-gray-300 p-2 flex flex-col items-center justify-between shadow-sm"
                        >
                          <div className="w-full text-center border-b border-gray-200 pb-1">
                            <p className="text-[6px] font-bold text-blue-600 tracking-wide">ECOCUT INVENTORY</p>
                          </div>
                          <p className="text-[8px] font-semibold text-center line-clamp-2 px-1">
                            {product.name}
                          </p>
                          <div className="flex-1 flex items-center justify-center py-1">
                            <QRCode
                              value={generateQRData(product)}
                              size={56}
                              level="M"
                            />
                          </div>
                          <div className="w-full text-center border-t border-gray-200 pt-1">
                            <p className="text-[8px] font-bold font-mono">{product.sku}</p>
                            <p className="text-[6px] text-gray-500 font-mono">
                              {product.barcode || product.sku}
                            </p>
                          </div>
                        </motion.div>
                      ))}
                  </AnimatePresence>
                  {selectedProducts.length > 4 && (
                    <div className="w-32 h-32 bg-gray-200 dark:bg-gray-700 rounded border-2 border-dashed border-gray-400 flex items-center justify-center">
                      <p className="text-sm text-gray-500 font-medium">
                        +{selectedProducts.length - 4} more
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center text-gray-500">
                  <QrCode className="w-12 h-12 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">Select products to preview labels</p>
                </div>
              )}
            </div>

            {/* Label Info */}
            <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <h4 className="font-semibold text-sm text-blue-800 dark:text-blue-300 mb-2">Label Information</h4>
              <ul className="text-xs text-blue-700 dark:text-blue-400 space-y-1">
                <li>• Size: 2" x 2" (standard inventory label)</li>
                <li>• QR Code contains: SKU, Product Name, Barcode</li>
                <li>• Compatible with standard label printers</li>
                <li>• Scannable with any QR code reader</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-between items-center mt-4 pt-4 border-t">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <div className="flex gap-2">
            <Button
              onClick={handlePrint}
              disabled={selectedProducts.length === 0 || isPrinting}
              className="bg-blue-600 hover:bg-blue-700"
              data-testid="print-labels-btn"
            >
              {isPrinting ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Printer className="w-4 h-4 mr-2" />
              )}
              Print {selectedProducts.length > 0 ? `${selectedProducts.length} Label${selectedProducts.length > 1 ? 's' : ''}` : 'Labels'}
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
        onClick={() => setIsOpen(true)}
        data-testid={`print-qr-btn-${product.id}`}
      >
        <QrCode className="w-4 h-4 mr-1" />
        QR Label
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
