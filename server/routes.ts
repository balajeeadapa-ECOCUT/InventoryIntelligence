import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./replitAuth";
import { requireAuth, requireRole, requirePermission, attachPermissions } from "./authMiddleware";
import { setupAuthRoutes } from "./authRoutes";
import {
  insertCategorySchema,
  insertProductFormSchema,
  insertStockMovementSchema,
} from "@shared/schema";
import multer from "multer";
import * as XLSX from "xlsx";
import { z } from "zod";
import express from "express";
import fs from "fs";
import { aiInventoryService } from "./ai-inventory";
import { aiOrchestrator } from "./ai-orchestrator";
import { emailAlertService } from "./email-alerts";
import { dailyStockAlertService } from "./daily-stock-alerts";
import * as pdfParse from "pdf-parse";

// Configure multer for Excel file uploads
const uploadExcel = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
        file.mimetype === 'application/vnd.ms-excel') {
      cb(null, true);
    } else {
      cb(new Error('Only Excel files are allowed'));
    }
  }
});

// Configure multer for image uploads
const uploadImage = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit for images
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
});

// Configure multer for PDF document uploads
const uploadPDF = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 20 * 1024 * 1024, // 20MB limit for PDFs
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed'));
    }
  }
});

export async function registerRoutes(app: Express): Promise<Server> {
  // Auth middleware (Replit Auth)
  await setupAuth(app);
  
  // Email/password auth routes
  setupAuthRoutes(app);

  // Auth routes - supports both Replit Auth and email/password auth
  app.get('/api/auth/user', async (req: any, res) => {
    try {
      let userId: string | undefined;
      
      // Check session-based auth first (email/password)
      if (req.session?.userId) {
        userId = req.session.userId;
      }
      // Fall back to Replit Auth
      else if (req.user?.claims?.sub) {
        userId = req.user.claims.sub;
      }
      
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(401).json({ message: "User not found" });
      }
      
      // Helper to sanitize user data (remove sensitive fields like password)
      const sanitizeUser = (u: typeof user) => ({
        id: u.id,
        email: u.email,
        firstName: u.firstName,
        lastName: u.lastName,
        role: u.role,
        status: u.status,
        phone: u.phone,
        profileImageUrl: u.profileImageUrl,
        createdAt: u.createdAt,
      });
      
      // Check if user is pending approval - don't expose any user data
      if (user.status === 'pending') {
        return res.status(403).json({ 
          message: "Account pending approval", 
          status: "pending"
        });
      }
      
      // Check if user is rejected
      if (user.status === 'rejected') {
        return res.status(403).json({ 
          message: "Account access denied", 
          status: "rejected" 
        });
      }
      
      // Return sanitized user data (never include password hash)
      res.json(sanitizeUser(user));
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Employee approval routes (admin only)
  app.get('/api/pending-employees', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      
      if (!user || user.role !== 'admin') {
        return res.status(403).json({ message: "Admin access required" });
      }
      
      const pendingEmployees = await storage.getPendingEmployees();
      // Sanitize employee data - never return password hashes
      const sanitizedPending = pendingEmployees.map(emp => ({
        id: emp.id,
        email: emp.email,
        firstName: emp.firstName,
        lastName: emp.lastName,
        role: emp.role,
        status: emp.status,
        phone: emp.phone,
        profileImageUrl: emp.profileImageUrl,
        createdAt: emp.createdAt,
      }));
      res.json(sanitizedPending);
    } catch (error) {
      console.error("Error fetching pending employees:", error);
      res.status(500).json({ message: "Failed to fetch pending employees" });
    }
  });

  app.post('/api/approve-employee/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      
      if (!user || user.role !== 'admin') {
        return res.status(403).json({ message: "Admin access required" });
      }
      
      const { status, role } = req.body;
      if (!["approved", "rejected"].includes(status)) {
        return res.status(400).json({ message: "Invalid status" });
      }
      
      // Validate role if provided
      const validRoles = ["admin", "manager", "sales_team"];
      if (role && !validRoles.includes(role)) {
        return res.status(400).json({ message: "Invalid role" });
      }
      
      const updatedUser = await storage.updateUserStatus(req.params.id, status, role);
      // Sanitize response - never return password hash
      res.json({
        id: updatedUser.id,
        email: updatedUser.email,
        firstName: updatedUser.firstName,
        lastName: updatedUser.lastName,
        role: updatedUser.role,
        status: updatedUser.status,
        phone: updatedUser.phone,
        profileImageUrl: updatedUser.profileImageUrl,
        createdAt: updatedUser.createdAt,
      });
    } catch (error) {
      console.error("Error updating employee status:", error);
      res.status(500).json({ message: "Failed to update employee status" });
    }
  });

  // Get all employees (admin only)
  app.get('/api/employees', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      
      if (!user || user.role !== 'admin') {
        return res.status(403).json({ message: "Admin access required" });
      }
      
      const employees = await storage.getAllEmployees();
      // Sanitize employee data - never return password hashes
      const sanitizedEmployees = employees.map(emp => ({
        id: emp.id,
        email: emp.email,
        firstName: emp.firstName,
        lastName: emp.lastName,
        role: emp.role,
        status: emp.status,
        phone: emp.phone,
        profileImageUrl: emp.profileImageUrl,
        createdAt: emp.createdAt,
      }));
      res.json(sanitizedEmployees);
    } catch (error) {
      console.error("Error fetching employees:", error);
      res.status(500).json({ message: "Failed to fetch employees" });
    }
  });

  // Update user role (admin only)
  app.patch('/api/users/:id/role', isAuthenticated, async (req: any, res) => {
    try {
      const currentUser = await storage.getUser(req.user.claims.sub);
      if (currentUser?.role !== 'admin') {
        return res.status(403).json({ message: "Only admins can update user roles" });
      }

      const { id } = req.params;
      const { role } = req.body;

      if (!['admin', 'manager', 'sales_team'].includes(role)) {
        return res.status(400).json({ message: "Invalid role" });
      }

      await storage.updateUser(id, { role });
      res.json({ message: "User role updated successfully" });
    } catch (error) {
      console.error("Error updating user role:", error);
      res.status(500).json({ message: "Failed to update user role" });
    }
  });

  // Delete employee (admin only)
  app.delete('/api/employees/:id', isAuthenticated, async (req: any, res) => {
    try {
      const currentUser = await storage.getUser(req.user.claims.sub);
      if (currentUser?.role !== 'admin') {
        return res.status(403).json({ message: "Only admins can delete employees" });
      }

      const { id } = req.params;
      
      // Prevent deleting yourself
      if (id === currentUser.id) {
        return res.status(400).json({ message: "You cannot delete your own account" });
      }

      await storage.deleteEmployee(id);
      res.json({ message: "Employee deleted successfully" });
    } catch (error) {
      console.error("Error deleting employee:", error);
      res.status(500).json({ message: "Failed to delete employee" });
    }
  });

  // Download Excel template for bulk upload
  app.get('/api/products/template', (req, res) => {
    try {
      // Create a new workbook
      const workbook = XLSX.utils.book_new();
      
      // Template with headers, data types row, and sample data
      // Row 1: Headers
      // Row 2: Data types (for user reference)
      // Row 3: Sample data
      const templateData = [
        // Headers row
        ["Product Name", "Description", "SKU", "Barcode", "Bin Location", "Supplier Name", "Category", "Unit Price", "Current Stock", "Min Stock Level", "Max Stock Level", "Image URL"],
        // Data types row - clearly indicates expected format
        ["TEXT (Required)", "TEXT (Optional)", "TEXT (Required)", "TEXT (Optional)", "TEXT (Optional)", "TEXT (Optional)", "TEXT (Optional)", "NUMBER (Required)", "NUMBER (Optional)", "NUMBER (Optional)", "NUMBER (Optional)", "TEXT (Optional)"],
        // Sample data row
        ["Example Product", "Product description here", "SKU-001", "1234567890123", "A1-B2-C3", "ABC Suppliers", "Electronics", 999.99, 50, 10, 100, "https://example.com/image.jpg"]
      ];
      
      // Create worksheet from array of arrays
      const worksheet = XLSX.utils.aoa_to_sheet(templateData);
      
      // Set column widths for better readability
      worksheet['!cols'] = [
        { wch: 20 },  // Product Name
        { wch: 25 },  // Description
        { wch: 18 },  // SKU
        { wch: 18 },  // Barcode
        { wch: 15 },  // Bin Location
        { wch: 20 },  // Supplier Name
        { wch: 15 },  // Category
        { wch: 18 },  // Unit Price
        { wch: 18 },  // Current Stock
        { wch: 18 },  // Min Stock Level
        { wch: 18 },  // Max Stock Level
        { wch: 30 },  // Image URL
      ];
      
      // Add worksheet to workbook
      XLSX.utils.book_append_sheet(workbook, worksheet, "Products");
      
      // Generate buffer
      const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
      
      // Set headers for file download
      res.setHeader('Content-Disposition', 'attachment; filename="product-upload-template.xlsx"');
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      
      res.send(buffer);
    } catch (error) {
      console.error("Error generating template:", error);
      res.status(500).json({ message: "Failed to generate template" });
    }
  });

  // Bulk upload products from Excel file
  app.post('/api/products/bulk-upload', isAuthenticated, requirePermission("canManageProducts"), uploadExcel.single('file'), async (req: any, res) => {
    try {
      // File validation
      if (!req.file) {
        return res.status(400).json({ 
          message: "No file uploaded",
          errorType: "FILE_MISSING",
          details: "Please select an Excel file (.xlsx or .xls) to upload"
        });
      }

      // Validate file type
      const allowedMimeTypes = [
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-excel'
      ];
      if (!allowedMimeTypes.includes(req.file.mimetype)) {
        return res.status(400).json({
          message: "Invalid file format",
          errorType: "INVALID_FILE_FORMAT",
          details: `Expected Excel file (.xlsx or .xls), but received: ${req.file.mimetype}. Please upload a valid Excel file.`
        });
      }

      // Parse Excel file with error handling
      let workbook;
      try {
        workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
      } catch (parseError) {
        return res.status(400).json({
          message: "Failed to parse Excel file",
          errorType: "FILE_PARSE_ERROR",
          details: "The uploaded file could not be read. It may be corrupted or not a valid Excel file. Please check the file and try again."
        });
      }

      if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
        return res.status(400).json({
          message: "Excel file has no worksheets",
          errorType: "EMPTY_WORKBOOK",
          details: "The uploaded Excel file contains no worksheets. Please ensure your file has at least one sheet with data."
        });
      }

      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const data = XLSX.utils.sheet_to_json(worksheet);

      if (!data.length) {
        return res.status(400).json({ 
          message: "Excel file is empty",
          errorType: "EMPTY_FILE",
          details: "The uploaded Excel file contains no data rows. Please add product data after the header row."
        });
      }

      const results = {
        successful: 0,
        skipped: 0,
        failed: 0,
        skippedRows: [] as { row: number; sku: string; reason: string }[],
        errors: [] as {
          row: number;
          field?: string;
          errorType: string;
          message: string;
          value?: any;
        }[]
      };

      // Get all categories for reference
      const categories = await storage.getCategories();
      const categoryMap = new Map(categories.map(cat => [cat.name.toLowerCase(), cat.id]));

      // Get ALL existing products to check for duplicates (use high limit to avoid pagination issues)
      const existingProducts = await storage.getProducts({ limit: 100000 });
      const existingSkus = new Set(existingProducts.products.map(p => p.sku?.toLowerCase()).filter(Boolean));
      const existingBarcodes = new Set(existingProducts.products.map(p => p.barcode?.toLowerCase()).filter(Boolean));

      // Track SKUs and barcodes within the current upload batch
      const batchSkus = new Set<string>();
      const batchBarcodes = new Set<string>();

      // Process each row
      for (let i = 0; i < data.length; i++) {
        const row = data[i] as any;
        const rowNumber = i + 2; // Excel row number (accounting for header)
        
        // Skip the data types row (contains "TEXT" or "NUMBER" indicators)
        const firstValue = String(row["Product Name"] || row["name"] || "");
        if (firstValue.includes("TEXT") || firstValue.includes("NUMBER") || firstValue.includes("Required") || firstValue.includes("Optional")) {
          continue;
        }
        
        const rowErrors: typeof results.errors = [];
        
        // Validate required fields
        const productName = row["Product Name"] || row["name"];
        if (!productName || String(productName).trim() === "") {
          rowErrors.push({
            row: rowNumber,
            field: "Product Name",
            errorType: "MISSING_REQUIRED_FIELD",
            message: "Product Name is required and cannot be empty",
            value: productName
          });
        }

        // Map Excel columns to our schema
        const rawSku = row["SKU"] || row["sku"];
        const rawBarcode = row["Barcode"] || row["barcode"];
        const rawBinLocation = row["Bin Location"] || row["binLocation"];
        const rawSupplierName = row["Supplier Name"] || row["supplierName"];
        const rawUnitPrice = row["Unit Price"] || row["unitPrice"];
        const rawCurrentStock = row["Current Stock"] || row["currentStock"];
        const rawMinStockLevel = row["Min Stock Level"] || row["minStockLevel"];
        const rawMaxStockLevel = row["Max Stock Level"] || row["maxStockLevel"];

        // Check SKU - skip if already exists in database
        const skuValue = rawSku !== undefined && rawSku !== null ? String(rawSku).trim() : "";
        if (skuValue) {
          const skuLower = skuValue.toLowerCase();
          if (existingSkus.has(skuLower)) {
            // Skip this row - SKU already exists
            results.skipped++;
            results.skippedRows.push({
              row: rowNumber,
              sku: skuValue,
              reason: "SKU already exists in database"
            });
            continue;
          } else if (batchSkus.has(skuLower)) {
            // Skip duplicate within same batch
            results.skipped++;
            results.skippedRows.push({
              row: rowNumber,
              sku: skuValue,
              reason: "Duplicate SKU within this upload file"
            });
            continue;
          }
          batchSkus.add(skuLower);
        }

        // Validate Barcode uniqueness
        const barcodeValue = rawBarcode !== undefined && rawBarcode !== null ? String(rawBarcode).trim() : "";
        if (barcodeValue) {
          const barcodeLower = barcodeValue.toLowerCase();
          if (existingBarcodes.has(barcodeLower)) {
            rowErrors.push({
              row: rowNumber,
              field: "Barcode",
              errorType: "DUPLICATE_BARCODE",
              message: `Barcode '${barcodeValue}' already exists in the database. Each product must have a unique barcode.`,
              value: barcodeValue
            });
          } else if (batchBarcodes.has(barcodeLower)) {
            rowErrors.push({
              row: rowNumber,
              field: "Barcode",
              errorType: "DUPLICATE_BARCODE_IN_BATCH",
              message: `Barcode '${barcodeValue}' is duplicated within this upload file. Each row must have a unique barcode.`,
              value: barcodeValue
            });
          }
          batchBarcodes.add(barcodeLower);
        }

        // Validate numeric fields
        if (rawUnitPrice !== undefined && rawUnitPrice !== null && rawUnitPrice !== "") {
          const parsedPrice = Number(rawUnitPrice);
          if (isNaN(parsedPrice)) {
            rowErrors.push({
              row: rowNumber,
              field: "Unit Price",
              errorType: "INVALID_DATA_TYPE",
              message: `Unit Price must be a valid number, but received: '${rawUnitPrice}'`,
              value: rawUnitPrice
            });
          } else if (parsedPrice < 0) {
            rowErrors.push({
              row: rowNumber,
              field: "Unit Price",
              errorType: "INVALID_VALUE",
              message: `Unit Price cannot be negative, but received: ${parsedPrice}`,
              value: rawUnitPrice
            });
          }
        }

        if (rawCurrentStock !== undefined && rawCurrentStock !== null && rawCurrentStock !== "") {
          const parsedStock = Number(rawCurrentStock);
          if (isNaN(parsedStock)) {
            rowErrors.push({
              row: rowNumber,
              field: "Current Stock",
              errorType: "INVALID_DATA_TYPE",
              message: `Current Stock must be a valid number, but received: '${rawCurrentStock}'`,
              value: rawCurrentStock
            });
          } else if (!Number.isInteger(parsedStock)) {
            rowErrors.push({
              row: rowNumber,
              field: "Current Stock",
              errorType: "INVALID_DATA_TYPE",
              message: `Current Stock must be a whole number, but received: ${rawCurrentStock}`,
              value: rawCurrentStock
            });
          } else if (parsedStock < 0) {
            rowErrors.push({
              row: rowNumber,
              field: "Current Stock",
              errorType: "INVALID_VALUE",
              message: `Current Stock cannot be negative, but received: ${parsedStock}`,
              value: rawCurrentStock
            });
          }
        }

        if (rawMinStockLevel !== undefined && rawMinStockLevel !== null && rawMinStockLevel !== "") {
          const parsedMin = Number(rawMinStockLevel);
          if (isNaN(parsedMin)) {
            rowErrors.push({
              row: rowNumber,
              field: "Min Stock Level",
              errorType: "INVALID_DATA_TYPE",
              message: `Min Stock Level must be a valid number, but received: '${rawMinStockLevel}'`,
              value: rawMinStockLevel
            });
          } else if (parsedMin < 0) {
            rowErrors.push({
              row: rowNumber,
              field: "Min Stock Level",
              errorType: "INVALID_VALUE",
              message: `Min Stock Level cannot be negative, but received: ${parsedMin}`,
              value: rawMinStockLevel
            });
          }
        }

        if (rawMaxStockLevel !== undefined && rawMaxStockLevel !== null && rawMaxStockLevel !== "") {
          const parsedMax = Number(rawMaxStockLevel);
          if (isNaN(parsedMax)) {
            rowErrors.push({
              row: rowNumber,
              field: "Max Stock Level",
              errorType: "INVALID_DATA_TYPE",
              message: `Max Stock Level must be a valid number, but received: '${rawMaxStockLevel}'`,
              value: rawMaxStockLevel
            });
          } else if (parsedMax < 0) {
            rowErrors.push({
              row: rowNumber,
              field: "Max Stock Level",
              errorType: "INVALID_VALUE",
              message: `Max Stock Level cannot be negative, but received: ${parsedMax}`,
              value: rawMaxStockLevel
            });
          }
        }

        // Validate min/max stock level relationship
        const parsedMinStock = Number(rawMinStockLevel) || 10;
        const parsedMaxStock = Number(rawMaxStockLevel) || 1000;
        if (!isNaN(parsedMinStock) && !isNaN(parsedMaxStock) && parsedMinStock > parsedMaxStock) {
          rowErrors.push({
            row: rowNumber,
            field: "Stock Levels",
            errorType: "INVALID_VALUE",
            message: `Min Stock Level (${parsedMinStock}) cannot be greater than Max Stock Level (${parsedMaxStock})`,
            value: { minStockLevel: rawMinStockLevel, maxStockLevel: rawMaxStockLevel }
          });
        }

        // If there are validation errors, add them and skip this row
        if (rowErrors.length > 0) {
          results.failed++;
          results.errors.push(...rowErrors);
          continue;
        }
        
        try {
          const productData = {
            name: productName,
            description: row["Description"] || row["description"] || "",
            sku: skuValue,
            barcode: barcodeValue,
            binLocation: rawBinLocation !== undefined && rawBinLocation !== null ? String(rawBinLocation) : "",
            supplierName: rawSupplierName !== undefined && rawSupplierName !== null ? String(rawSupplierName) : "",
            categoryId: null as number | null,
            unitPrice: Number(rawUnitPrice || 0),
            currentStock: Number(rawCurrentStock || 0),
            minStockLevel: Number(rawMinStockLevel || 10),
            maxStockLevel: Number(rawMaxStockLevel || 1000),
            imageUrl: row["Image URL"] || row["imageUrl"] || "",
            isActive: true
          };

          // Find category ID by name, or auto-create if not exists
          const categoryName = row["Category"] || row["category"];
          if (categoryName) {
            const categoryNameStr = String(categoryName).trim();
            const categoryNameLower = categoryNameStr.toLowerCase();
            let categoryId = categoryMap.get(categoryNameLower);
            
            if (!categoryId) {
              // Auto-create the category
              try {
                const newCategory = await storage.createCategory({
                  name: categoryNameStr,
                  description: ""
                });
                categoryId = newCategory.id;
                categoryMap.set(categoryNameLower, categoryId);
                categories.push(newCategory);
              } catch (categoryError) {
                // Check if it's a duplicate error (race condition)
                const existingCategories = await storage.getCategories();
                const foundCategory = existingCategories.find(
                  c => c.name.toLowerCase() === categoryNameLower
                );
                if (foundCategory) {
                  categoryId = foundCategory.id;
                  categoryMap.set(categoryNameLower, categoryId);
                } else {
                  rowErrors.push({
                    row: rowNumber,
                    field: "Category",
                    errorType: "CATEGORY_CREATE_ERROR",
                    message: `Failed to create category '${categoryNameStr}'`,
                    value: categoryName
                  });
                }
              }
            }
            
            if (categoryId) {
              productData.categoryId = categoryId;
            }
          }

          if (rowErrors.length > 0) {
            results.failed++;
            results.errors.push(...rowErrors);
            continue;
          }

          // Validate the product data with schema
          const validatedData = insertProductFormSchema.parse(productData);

          // Convert unitPrice to string for database storage
          const dbProductData = {
            ...validatedData,
            unitPrice: validatedData.unitPrice.toString()
          };

          // Create product
          await storage.createProduct(dbProductData as any);
          results.successful++;

          // Add to existing sets to prevent duplicates within same upload
          if (skuValue) existingSkus.add(skuValue.toLowerCase());
          if (barcodeValue) existingBarcodes.add(barcodeValue.toLowerCase());

        } catch (error) {
          results.failed++;
          
          // Parse Zod validation errors for more specific messages
          if (error instanceof z.ZodError) {
            for (const issue of error.issues) {
              results.errors.push({
                row: rowNumber,
                field: issue.path.join('.') || "Unknown field",
                errorType: "VALIDATION_ERROR",
                message: issue.message,
                value: issue.path.length > 0 ? row[issue.path[0] as string] : undefined
              });
            }
          } else {
            results.errors.push({
              row: rowNumber,
              field: undefined,
              errorType: "PROCESSING_ERROR",
              message: error instanceof Error ? error.message : "An unexpected error occurred while processing this row",
              value: undefined
            });
          }
        }
      }

      // Broadcast update to clients
      broadcastToClients({
        type: "PRODUCTS_BULK_UPLOADED",
        data: { results }
      });

      res.json({
        message: `Bulk upload completed. ${results.successful} products added, ${results.skipped} skipped (already exist), ${results.failed} had errors.`,
        results,
        summary: {
          totalRows: data.length,
          processed: results.successful + results.skipped + results.failed,
          successful: results.successful,
          skipped: results.skipped,
          failed: results.failed,
          skippedRows: results.skippedRows,
          errorsByType: results.errors.reduce((acc, err) => {
            acc[err.errorType] = (acc[err.errorType] || 0) + 1;
            return acc;
          }, {} as Record<string, number>)
        }
      });

    } catch (error) {
      console.error("Error processing bulk upload:", error);
      res.status(500).json({ 
        message: "Failed to process bulk upload",
        errorType: "SERVER_ERROR",
        details: error instanceof Error ? error.message : "An unexpected error occurred on the server. Please try again or contact support if the issue persists."
      });
    }
  });

  // Initialize sample data
  app.get('/api/init-sample-data', async (req: any, res) => {
    try {
      // Check if categories already exist
      const existingCategories = await storage.getCategories();
      if (existingCategories.length > 0) {
        return res.json({ message: "Sample data already exists" });
      }

      // Create sample categories
      const categories = [
        { name: "Electronics", description: "Electronic devices and components" },
        { name: "Office Supplies", description: "Office and business supplies" },
        { name: "Hardware", description: "Tools and hardware items" },
      ];

      for (const category of categories) {
        await storage.createCategory(category);
      }

      res.json({ message: "Sample data initialized successfully" });
    } catch (error) {
      console.error("Error initializing sample data:", error);
      res.status(500).json({ message: "Failed to initialize sample data" });
    }
  });

  // Dashboard routes
  app.get("/api/dashboard/stats", isAuthenticated, async (req, res) => {
    try {
      const stats = await storage.getDashboardStats();
      res.json(stats);
    } catch (error) {
      console.error("Error fetching dashboard stats:", error);
      res.status(500).json({ message: "Failed to fetch dashboard stats" });
    }
  });

  // Category routes
  app.get("/api/categories", isAuthenticated, async (req, res) => {
    try {
      const categories = await storage.getCategories();
      res.json(categories);
    } catch (error) {
      console.error("Error fetching categories:", error);
      res.status(500).json({ message: "Failed to fetch categories" });
    }
  });

  app.post("/api/categories", isAuthenticated, async (req, res) => {
    try {
      const categoryData = insertCategorySchema.parse(req.body);
      const category = await storage.createCategory(categoryData);
      res.status(201).json(category);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid category data", errors: error.errors });
      }
      console.error("Error creating category:", error);
      res.status(500).json({ message: "Failed to create category" });
    }
  });

  app.put("/api/categories/:id", isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const categoryData = insertCategorySchema.partial().parse(req.body);
      const category = await storage.updateCategory(id, categoryData);
      res.json(category);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid category data", errors: error.errors });
      }
      console.error("Error updating category:", error);
      res.status(500).json({ message: "Failed to update category" });
    }
  });

  app.delete("/api/categories/:id", isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteCategory(id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting category:", error);
      res.status(500).json({ message: "Failed to delete category" });
    }
  });

  // Product routes
  app.get("/api/products", isAuthenticated, async (req, res) => {
    try {
      const {
        categoryId,
        stockLevel,
        search,
        limit = 20,
        offset = 0,
      } = req.query;

      const filters = {
        categoryId: categoryId ? parseInt(categoryId as string) : undefined,
        stockLevel: stockLevel as "low" | "out" | "all" | undefined,
        search: search as string | undefined,
        limit: parseInt(limit as string),
        offset: parseInt(offset as string),
      };

      const result = await storage.getProducts(filters);
      res.json(result);
    } catch (error) {
      console.error("Error fetching products:", error);
      res.status(500).json({ message: "Failed to fetch products" });
    }
  });

  app.get("/api/products/:id", isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const product = await storage.getProduct(id);
      
      if (!product) {
        return res.status(404).json({ message: "Product not found" });
      }
      
      res.json(product);
    } catch (error) {
      console.error("Error fetching product:", error);
      res.status(500).json({ message: "Failed to fetch product" });
    }
  });

  app.post("/api/products", isAuthenticated, async (req, res) => {
    try {
      console.log("Creating product with data:", JSON.stringify(req.body, null, 2));
      const validatedData = insertProductFormSchema.parse(req.body);
      
      // Prepare data for database insertion
      const productData: any = {
        name: validatedData.name,
        description: validatedData.description,
        sku: validatedData.sku,
        barcode: validatedData.barcode,
        binLocation: validatedData.binLocation,
        supplierName: validatedData.supplierName,
        categoryId: validatedData.categoryId,
        unitPrice: validatedData.unitPrice.toString(), // Convert number to string for Drizzle decimal type
        currentStock: validatedData.currentStock,
        minStockLevel: validatedData.minStockLevel,
        maxStockLevel: validatedData.maxStockLevel,
        imageUrl: validatedData.imageUrl,
      };
      
      const product = await storage.createProduct(productData);
      
      // Broadcast product creation
      broadcastToClients({
        type: "PRODUCT_CREATED",
        data: product,
      });
      
      res.status(201).json(product);
    } catch (error) {
      if (error instanceof z.ZodError) {
        console.error("Validation errors:", JSON.stringify(error.errors, null, 2));
        return res.status(400).json({ message: "Invalid product data", errors: error.errors });
      }
      console.error("Error creating product:", error);
      res.status(500).json({ message: "Failed to create product" });
    }
  });

  app.put("/api/products/:id", isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const validatedData = insertProductFormSchema.partial().parse(req.body);
      
      // Prepare data for database update
      const productData: any = {
        ...validatedData,
        ...(validatedData.unitPrice !== undefined && { unitPrice: validatedData.unitPrice.toString() }),
      };
      
      const product = await storage.updateProduct(id, productData as any);
      
      // Broadcast product update
      broadcastToClients({
        type: "PRODUCT_UPDATED",
        data: product,
      });
      
      res.json(product);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid product data", errors: error.errors });
      }
      console.error("Error updating product:", error);
      res.status(500).json({ message: "Failed to update product" });
    }
  });

  app.delete("/api/products/:id", isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteProduct(id);
      
      // Broadcast product deletion
      broadcastToClients({
        type: "PRODUCT_DELETED",
        data: { id },
      });
      
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting product:", error);
      res.status(500).json({ message: "Failed to delete product" });
    }
  });

  // Stock adjustment route
  app.post("/api/products/:id/stock", isAuthenticated, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const { newStock, reason } = req.body;
      const userId = req.user.claims.sub;
      
      if (typeof newStock !== "number" || newStock < 0) {
        return res.status(400).json({ message: "Invalid stock value" });
      }
      
      await storage.updateProductStock(id, newStock, userId, reason);
      
      // Get updated product
      const product = await storage.getProduct(id);
      
      // Broadcast stock update
      broadcastToClients({
        type: "STOCK_UPDATED",
        data: product,
      });
      
      res.json({ message: "Stock updated successfully", product });
    } catch (error) {
      console.error("Error updating stock:", error);
      res.status(500).json({ message: "Failed to update stock" });
    }
  });

  // Image upload endpoint
  app.post("/api/upload/image", isAuthenticated, uploadImage.single('image'), async (req: any, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No image file provided" });
      }

      // Generate unique filename
      const timestamp = Date.now();
      const fileExtension = req.file.originalname.split('.').pop();
      const filename = `product_${timestamp}.${fileExtension}`;
      
      // Create uploads directory if it doesn't exist
      const uploadsDir = './uploads';
      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
      }

      // Save file to uploads directory
      const filepath = `${uploadsDir}/${filename}`;
      fs.writeFileSync(filepath, req.file.buffer);

      // Return the URL path for the uploaded image
      const imageUrl = `/uploads/${filename}`;
      res.json({ imageUrl });
    } catch (error) {
      console.error("Error uploading image:", error);
      res.status(500).json({ message: "Failed to upload image" });
    }
  });

  // Serve uploaded images statically
  app.use('/uploads', express.static('./uploads'));

  // Stock movement endpoints
  app.post("/api/stock-movements", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) {
        return res.status(401).json({ message: "User ID not found" });
      }

      const { productId, type, quantity, reason, notes, invoiceNumber, invoiceDate } = req.body;

      // Validate input
      if (!productId || !type || !quantity || !reason) {
        return res.status(400).json({ 
          message: "Missing required fields: productId, type, quantity, reason" 
        });
      }

      if (!["IN", "OUT", "ADJUSTMENT"].includes(type)) {
        return res.status(400).json({ 
          message: "Invalid movement type. Must be IN, OUT, or ADJUSTMENT" 
        });
      }

      if (quantity <= 0) {
        return res.status(400).json({ 
          message: "Quantity must be positive" 
        });
      }

      // Get current product to check stock levels
      const product = await storage.getProduct(productId);
      if (!product) {
        return res.status(404).json({ message: "Product not found" });
      }

      // Calculate new stock level
      let newStock = product.currentStock;
      if (type === "IN") {
        newStock += quantity;
      } else if (type === "OUT") {
        newStock -= quantity;
        if (newStock < 0) {
          return res.status(400).json({ 
            message: `Insufficient stock. Current: ${product.currentStock}, Requested: ${quantity}` 
          });
        }
      } else if (type === "ADJUSTMENT") {
        // For adjustments, the quantity represents the new total stock level
        newStock = quantity;
      }

      // Create stock movement record
      const movementData = {
        productId,
        userId,
        type,
        quantity,
        previousStock: product.currentStock,
        newStock,
        reason,
        invoiceNumber: invoiceNumber || null,
        invoiceDate: invoiceDate ? new Date(invoiceDate) : null,
        notes: notes || null,
      };

      const movement = await storage.createStockMovement(movementData);

      // Update product stock level
      await storage.updateProductStock(productId, newStock, userId, reason);

      // Broadcast stock update
      broadcastToClients({
        type: "STOCK_UPDATED",
        data: { productId, newStock, movement },
      });

      res.status(201).json(movement);
    } catch (error) {
      console.error("Error creating stock movement:", error);
      res.status(500).json({ message: "Failed to create stock movement" });
    }
  });

  // Stock movement template download
  app.get('/api/stock-movements/template', (req, res) => {
    try {
      // Create a new workbook
      const workbook = XLSX.utils.book_new();
      
      // Sample data for stock movements template
      const templateData = [
        {
          "Product SKU": "REF-1443-010",
          "Movement Type": "IN",
          "Quantity": "50",
          "Reason": "Purchase",
          "Notes": "New stock received from supplier"
        },
        {
          "Product SKU": "REF-1443-010", 
          "Movement Type": "OUT",
          "Quantity": "10",
          "Reason": "Sale",
          "Notes": "Sold to customer ABC Ltd"
        },
        {
          "Product SKU": "REF-1443-010",
          "Movement Type": "ADJUSTMENT",
          "Quantity": "45",
          "Reason": "Audit",
          "Notes": "Physical count correction"
        }
      ];
      
      // Create worksheet
      const worksheet = XLSX.utils.json_to_sheet(templateData);
      
      // Add worksheet to workbook
      XLSX.utils.book_append_sheet(workbook, worksheet, "Stock Movements");
      
      // Generate buffer
      const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
      
      // Set headers
      res.setHeader('Content-Disposition', 'attachment; filename="stock_movements_template.xlsx"');
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      
      // Send file
      res.send(buffer);
    } catch (error) {
      console.error("Error generating stock movements template:", error);
      res.status(500).json({ message: "Failed to generate template" });
    }
  });

  // Bulk upload stock movements from Excel file
  app.post('/api/stock-movements/bulk-upload', isAuthenticated, uploadExcel.single('file'), async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) {
        return res.status(401).json({ message: "User ID not found" });
      }

      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }

      // Parse Excel file
      const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const data = XLSX.utils.sheet_to_json(worksheet);

      if (!data.length) {
        return res.status(400).json({ message: "Excel file is empty" });
      }

      const results = {
        successful: 0,
        failed: 0,
        errors: [] as any[]
      };

      // Get all products for SKU lookup
      const products = await storage.getProducts({});
      const productMap = new Map(products.products.map(product => [product.sku.toLowerCase(), product]));

      // Process each row
      for (let i = 0; i < data.length; i++) {
        const row = data[i] as any;
        
        try {
          // Map Excel columns to our schema
          const productSku = row["Product SKU"] || row["productSku"] || row["sku"];
          const type = row["Movement Type"] || row["type"];
          const quantity = Number(row["Quantity"] || row["quantity"] || 0);
          const reason = row["Reason"] || row["reason"] || "";
          const notes = row["Notes"] || row["notes"] || "";

          // Validate required fields
          if (!productSku || !type || !quantity || !reason) {
            throw new Error("Missing required fields: Product SKU, Movement Type, Quantity, Reason");
          }

          // Validate movement type
          if (!["IN", "OUT", "ADJUSTMENT"].includes(type.toUpperCase())) {
            throw new Error("Invalid movement type. Must be IN, OUT, or ADJUSTMENT");
          }

          // Find product by SKU
          const product = productMap.get(productSku.toLowerCase());
          if (!product) {
            throw new Error(`Product with SKU '${productSku}' not found`);
          }

          // Calculate new stock level
          let newStock = product.currentStock;
          const normalizedType = type.toUpperCase();
          
          if (normalizedType === "IN") {
            newStock += quantity;
          } else if (normalizedType === "OUT") {
            newStock -= quantity;
            if (newStock < 0) {
              throw new Error(`Insufficient stock. Current: ${product.currentStock}, Requested: ${quantity}`);
            }
          } else if (normalizedType === "ADJUSTMENT") {
            newStock = quantity;
          }

          // Create stock movement record
          const movementData = {
            productId: product.id,
            userId,
            type: normalizedType as "IN" | "OUT" | "ADJUSTMENT",
            quantity,
            previousStock: product.currentStock,
            newStock,
            reason,
            notes: notes || null,
          };

          await storage.createStockMovement(movementData);
          await storage.updateProductStock(product.id, newStock, userId, reason);

          results.successful++;

        } catch (error) {
          results.failed++;
          results.errors.push({
            row: i + 2, // Excel row number (accounting for header)
            data: { productSku: row["Product SKU"], type: row["Movement Type"], quantity: row["Quantity"] },
            error: error instanceof Error ? error.message : "Unknown error"
          });
        }
      }

      // Broadcast bulk stock update
      broadcastToClients({
        type: "BULK_STOCK_UPDATED",
        data: { successful: results.successful, failed: results.failed },
      });

      res.json(results);
    } catch (error) {
      console.error("Error processing bulk stock movements:", error);
      res.status(500).json({ message: "Failed to process bulk stock movements" });
    }
  });

  // Stock movements routes
  app.get("/api/stock-movements", isAuthenticated, async (req, res) => {
    try {
      const { productId, limit } = req.query;
      const movements = await storage.getStockMovements(
        productId ? parseInt(productId as string) : undefined,
        limit ? parseInt(limit as string) : undefined
      );
      res.json(movements);
    } catch (error) {
      console.error("Error fetching stock movements:", error);
      res.status(500).json({ message: "Failed to fetch stock movements" });
    }
  });

  // AI-powered inventory routes
  app.get("/api/ai/demand-forecast", isAuthenticated, async (req, res) => {
    try {
      const { productId } = req.query;
      const forecast = await aiInventoryService.generateDemandForecast(
        productId ? parseInt(productId as string) : undefined
      );
      res.json(forecast);
    } catch (error) {
      console.error("Error generating demand forecast:", error);
      res.status(500).json({ message: "Failed to generate demand forecast" });
    }
  });

  app.get("/api/ai/inventory-insights", isAuthenticated, async (req, res) => {
    try {
      const insights = await aiInventoryService.generateInventoryInsights();
      res.json(insights);
    } catch (error) {
      console.error("Error generating inventory insights:", error);
      res.status(500).json({ message: "Failed to generate inventory insights" });
    }
  });

  app.get("/api/ai/stock-optimization", isAuthenticated, async (req, res) => {
    try {
      const optimizations = await aiInventoryService.optimizeStockLevels();
      res.json(optimizations);
    } catch (error) {
      console.error("Error optimizing stock levels:", error);
      res.status(500).json({ message: "Failed to optimize stock levels" });
    }
  });

  app.get("/api/ai/reorder-recommendations", isAuthenticated, async (req, res) => {
    try {
      const recommendations = await aiInventoryService.generateReorderRecommendations();
      res.json(recommendations);
    } catch (error) {
      console.error("Error generating reorder recommendations:", error);
      res.status(500).json({ message: "Failed to generate reorder recommendations" });
    }
  });

  // Advanced AI Orchestrator Routes

  // Natural Language Query
  app.post("/api/ai/query", isAuthenticated, async (req: any, res) => {
    try {
      const { query } = req.body;
      const userId = req.user.claims.sub;
      
      if (!query || typeof query !== 'string') {
        return res.status(400).json({ message: "Query is required" });
      }

      const result = await aiOrchestrator.processNaturalLanguageQuery(query, userId);
      res.json(result);
    } catch (error) {
      console.error("Error processing natural language query:", error);
      res.status(500).json({ message: "Failed to process query" });
    }
  });

  // AI Chat
  app.post("/api/ai/chat", isAuthenticated, async (req: any, res) => {
    try {
      const { sessionId, message } = req.body;
      const userId = req.user.claims.sub;
      
      if (!message || typeof message !== 'string') {
        return res.status(400).json({ message: "Message is required" });
      }

      const chatSessionId = sessionId || `session_${userId}_${Date.now()}`;
      const response = await aiOrchestrator.chat(chatSessionId, message, userId);
      
      res.json({
        sessionId: chatSessionId,
        message: response
      });
    } catch (error) {
      console.error("Error in AI chat:", error);
      res.status(500).json({ message: "Failed to process chat message" });
    }
  });

  // Get chat history
  app.get("/api/ai/chat/:sessionId/history", isAuthenticated, async (req, res) => {
    try {
      const { sessionId } = req.params;
      const history = aiOrchestrator.getChatHistory(sessionId);
      res.json(history);
    } catch (error) {
      console.error("Error fetching chat history:", error);
      res.status(500).json({ message: "Failed to fetch chat history" });
    }
  });

  // Clear chat history
  app.delete("/api/ai/chat/:sessionId", isAuthenticated, async (req, res) => {
    try {
      const { sessionId } = req.params;
      aiOrchestrator.clearChatHistory(sessionId);
      res.json({ message: "Chat history cleared" });
    } catch (error) {
      console.error("Error clearing chat history:", error);
      res.status(500).json({ message: "Failed to clear chat history" });
    }
  });

  // Predictive Analytics
  app.get("/api/ai/predictive-analytics", isAuthenticated, async (req, res) => {
    try {
      const { productId } = req.query;
      const analytics = await aiOrchestrator.generatePredictiveAnalytics(
        productId ? parseInt(productId as string) : undefined
      );
      res.json(analytics);
    } catch (error) {
      console.error("Error generating predictive analytics:", error);
      res.status(500).json({ message: "Failed to generate predictive analytics" });
    }
  });

  // Vendor Recommendations
  app.post("/api/ai/vendor-recommendations", isAuthenticated, async (req, res) => {
    try {
      const { productName, quantity } = req.body;
      
      if (!productName || !quantity) {
        return res.status(400).json({ message: "Product name and quantity are required" });
      }

      const recommendations = await aiOrchestrator.getVendorRecommendations(productName, quantity);
      res.json(recommendations);
    } catch (error) {
      console.error("Error getting vendor recommendations:", error);
      res.status(500).json({ message: "Failed to get vendor recommendations" });
    }
  });

  // Document Processing (PDF upload)
  app.post("/api/ai/process-document", isAuthenticated, uploadPDF.single('document'), async (req: any, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No PDF file uploaded" });
      }

      // Extract text from PDF
      const pdfData = await (pdfParse as any).default(req.file.buffer);
      const textContent = pdfData.text;

      if (!textContent || textContent.trim().length === 0) {
        return res.status(400).json({ message: "Could not extract text from PDF" });
      }

      // Process with AI
      const extraction = await aiOrchestrator.extractDocumentData(textContent);
      res.json(extraction);
    } catch (error) {
      console.error("Error processing document:", error);
      res.status(500).json({ message: "Failed to process document" });
    }
  });

  // Alert Insights
  app.get("/api/ai/alert-insights", isAuthenticated, async (req, res) => {
    try {
      const alerts = await aiOrchestrator.generateAlertInsights();
      res.json(alerts);
    } catch (error) {
      console.error("Error generating alert insights:", error);
      res.status(500).json({ message: "Failed to generate alert insights" });
    }
  });

  // Voice Query Processing
  app.post("/api/ai/voice-query", isAuthenticated, async (req: any, res) => {
    try {
      const { transcription } = req.body;
      const userId = req.user.claims.sub;
      
      if (!transcription || typeof transcription !== 'string') {
        return res.status(400).json({ message: "Voice transcription is required" });
      }

      const result = await aiOrchestrator.processVoiceQuery(transcription, userId);
      res.json(result);
    } catch (error) {
      console.error("Error processing voice query:", error);
      res.status(500).json({ message: "Failed to process voice query" });
    }
  });

  // Email Alerts Routes

  // Generate stock alerts
  app.get("/api/alerts/generate", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (user?.role !== 'admin' && user?.role !== 'manager') {
        return res.status(403).json({ message: "Admin or manager access required" });
      }

      const alerts = await emailAlertService.generateStockAlerts();
      res.json(alerts);
    } catch (error) {
      console.error("Error generating alerts:", error);
      res.status(500).json({ message: "Failed to generate alerts" });
    }
  });

  // Generate daily digest
  app.get("/api/alerts/digest", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (user?.role !== 'admin' && user?.role !== 'manager') {
        return res.status(403).json({ message: "Admin or manager access required" });
      }

      const digest = await emailAlertService.generateDailyDigest();
      res.json(digest);
    } catch (error) {
      console.error("Error generating digest:", error);
      res.status(500).json({ message: "Failed to generate digest" });
    }
  });

  // Get all alerts
  app.get("/api/alerts", isAuthenticated, async (req, res) => {
    try {
      const alerts = emailAlertService.getAllAlerts();
      res.json(alerts);
    } catch (error) {
      console.error("Error fetching alerts:", error);
      res.status(500).json({ message: "Failed to fetch alerts" });
    }
  });

  // Get pending alerts
  app.get("/api/alerts/pending", isAuthenticated, async (req, res) => {
    try {
      const alerts = emailAlertService.getPendingAlerts();
      res.json(alerts);
    } catch (error) {
      console.error("Error fetching pending alerts:", error);
      res.status(500).json({ message: "Failed to fetch pending alerts" });
    }
  });

  // Mark alert as sent
  app.post("/api/alerts/:id/send", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (user?.role !== 'admin') {
        return res.status(403).json({ message: "Admin access required" });
      }

      emailAlertService.markAlertAsSent(req.params.id);
      res.json({ message: "Alert marked as sent" });
    } catch (error) {
      console.error("Error marking alert as sent:", error);
      res.status(500).json({ message: "Failed to mark alert as sent" });
    }
  });

  // Daily Stock Alert Endpoints
  
  // Get stock alert report preview (HTML/text)
  app.get("/api/stock-alerts/preview", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (user?.role !== 'admin' && user?.role !== 'manager') {
        return res.status(403).json({ message: "Admin or Manager access required" });
      }

      const report = await dailyStockAlertService.generateStockReport();
      res.json({
        lowStockCount: report.lowStockItems.length,
        outOfStockCount: report.outOfStockItems.length,
        lowStockItems: report.lowStockItems,
        outOfStockItems: report.outOfStockItems,
        htmlPreview: report.htmlReport,
        textPreview: report.textReport,
      });
    } catch (error) {
      console.error("Error generating stock alert preview:", error);
      res.status(500).json({ message: "Failed to generate stock alert preview" });
    }
  });

  // Manually trigger stock alert email
  app.post("/api/stock-alerts/send", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (user?.role !== 'admin') {
        return res.status(403).json({ message: "Admin access required" });
      }

      const result = await dailyStockAlertService.sendDailyAlert();
      res.json({
        message: result.status === 'success' 
          ? `Stock alert email sent to ${result.recipient}` 
          : result.status === 'skipped'
          ? `Alert skipped: ${result.error}`
          : `Alert failed: ${result.error}`,
        log: result,
      });
    } catch (error) {
      console.error("Error sending stock alert:", error);
      res.status(500).json({ message: "Failed to send stock alert" });
    }
  });

  // Get stock alert logs
  app.get("/api/stock-alerts/logs", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (user?.role !== 'admin') {
        return res.status(403).json({ message: "Admin access required" });
      }

      const logs = dailyStockAlertService.getLogs();
      res.json(logs);
    } catch (error) {
      console.error("Error fetching stock alert logs:", error);
      res.status(500).json({ message: "Failed to fetch stock alert logs" });
    }
  });

  // Get stock alert scheduler status
  app.get("/api/stock-alerts/status", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (user?.role !== 'admin') {
        return res.status(403).json({ message: "Admin access required" });
      }

      // Get settings from database with env var fallback
      const dbEnabled = await storage.getSetting('daily_stock_alerts_enabled');
      const dbRecipient = await storage.getSetting('stock_alert_email');
      
      const enabled = dbEnabled !== null ? dbEnabled === 'true' : process.env.DAILY_STOCK_ALERTS_ENABLED !== 'false';
      const recipient = dbRecipient || process.env.STOCK_ALERT_EMAIL || 'not configured';

      res.json({
        enabled,
        recipient,
        smtpConfigured: !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS),
        scheduledTime: '9:00 AM IST (3:30 AM UTC)',
        logs: dailyStockAlertService.getLogs().slice(0, 5),
      });
    } catch (error) {
      console.error("Error fetching stock alert status:", error);
      res.status(500).json({ message: "Failed to fetch stock alert status" });
    }
  });

  // Update stock alert settings
  app.patch("/api/stock-alerts/settings", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (user?.role !== 'admin') {
        return res.status(403).json({ message: "Admin access required" });
      }


      // API endpoint to get current user's role and permissions
      app.get("/api/user/permissions", requireAuth, attachPermissions, async (req, res) => {
        try {
          if (!req.user) {
            return res.status(401).json({ error: "Not authenticated" });
          }

          const permissions = getUserPermissions(req.user.role);

          res.json({
            user: {
              id: req.user.id,
              email: req.user.email,
              firstName: req.user.firstName,
              lastName: req.user.lastName,
              role: req.user.role,
            },
            permissions,
          });
        } catch (error) {
          console.error("Error fetching user permissions:", error);
          res.status(500).json({ error: "Failed to fetch permissions" });
        }
      });
      const { enabled, recipient } = req.body;

      if (typeof enabled === 'boolean') {
        await storage.setSetting('daily_stock_alerts_enabled', enabled.toString());
      }

      if (typeof recipient === 'string' && recipient.trim()) {
        await storage.setSetting('stock_alert_email', recipient.trim());
      }

      // Get updated values
      const dbEnabled = await storage.getSetting('daily_stock_alerts_enabled');
      const dbRecipient = await storage.getSetting('stock_alert_email');

      res.json({
        enabled: dbEnabled !== null ? dbEnabled === 'true' : process.env.DAILY_STOCK_ALERTS_ENABLED !== 'false',
        recipient: dbRecipient || process.env.STOCK_ALERT_EMAIL || 'not configured',
        message: 'Settings updated successfully',
      });
    } catch (error) {
      console.error("Error updating stock alert settings:", error);
      res.status(500).json({ message: "Failed to update stock alert settings" });
    }
  });

  // Start the daily stock alert scheduler
  dailyStockAlertService.startScheduler();

  const httpServer = createServer(app);

  // WebSocket server for real-time updates
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });
  const clients = new Set<WebSocket>();

  wss.on('connection', (ws) => {
    clients.add(ws);
    console.log('Client connected to WebSocket');

    ws.on('close', () => {
      clients.delete(ws);
      console.log('Client disconnected from WebSocket');
    });

    ws.on('error', (error) => {
      console.error('WebSocket error:', error);
      clients.delete(ws);
    });
  });

  function broadcastToClients(message: any) {
    const messageStr = JSON.stringify(message);
    clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(messageStr);
      }
    });
  }

  return httpServer;
}
