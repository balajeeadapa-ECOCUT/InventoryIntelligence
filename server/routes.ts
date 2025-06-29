import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./replitAuth";
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

export async function registerRoutes(app: Express): Promise<Server> {
  // Auth middleware
  await setupAuth(app);

  // Auth routes
  app.get('/api/auth/user', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      
      // Check if user is pending approval
      if (user && user.status === 'pending') {
        return res.status(403).json({ 
          message: "Account pending approval", 
          status: "pending",
          user: user 
        });
      }
      
      // Check if user is rejected
      if (user && user.status === 'rejected') {
        return res.status(403).json({ 
          message: "Account access denied", 
          status: "rejected" 
        });
      }
      
      res.json(user);
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
      res.json(pendingEmployees);
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
      
      const { status } = req.body;
      if (!["approved", "rejected"].includes(status)) {
        return res.status(400).json({ message: "Invalid status" });
      }
      
      const updatedUser = await storage.updateUserStatus(req.params.id, status);
      res.json(updatedUser);
    } catch (error) {
      console.error("Error updating employee status:", error);
      res.status(500).json({ message: "Failed to update employee status" });
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

      if (!['admin', 'manager', 'employee'].includes(role)) {
        return res.status(400).json({ message: "Invalid role" });
      }

      await storage.updateUser(id, { role });
      res.json({ message: "User role updated successfully" });
    } catch (error) {
      console.error("Error updating user role:", error);
      res.status(500).json({ message: "Failed to update user role" });
    }
  });

  // Download Excel template for bulk upload
  app.get('/api/products/template', (req, res) => {
    try {
      // Create a new workbook
      const workbook = XLSX.utils.book_new();
      
      // Sample data for template
      const templateData = [
        {
          "Product Name": "Example Product",
          "Description": "Product description",
          "SKU": "EX001",
          "Barcode": "1234567890123",
          "Category": "Electronics",
          "Unit Price": "999.99",
          "Current Stock": "50",
          "Min Stock Level": "10",
          "Max Stock Level": "100",
          "Image URL": "https://example.com/image.jpg"
        }
      ];
      
      // Create worksheet
      const worksheet = XLSX.utils.json_to_sheet(templateData);
      
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
  app.post('/api/products/bulk-upload', isAuthenticated, uploadExcel.single('file'), async (req: any, res) => {
    try {
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

      // Get all categories for reference
      const categories = await storage.getCategories();
      const categoryMap = new Map(categories.map(cat => [cat.name.toLowerCase(), cat.id]));

      // Process each row
      for (let i = 0; i < data.length; i++) {
        const row = data[i] as any;
        
        try {
          // Map Excel columns to our schema
          const productData = {
            name: row["Product Name"] || row["name"],
            description: row["Description"] || row["description"] || "",
            sku: row["SKU"] || row["sku"],
            barcode: row["Barcode"] || row["barcode"] || "",
            categoryId: null as number | null,
            unitPrice: Number(row["Unit Price"] || row["unitPrice"] || 0),
            currentStock: Number(row["Current Stock"] || row["currentStock"] || 0),
            minStockLevel: Number(row["Min Stock Level"] || row["minStockLevel"] || 10),
            maxStockLevel: Number(row["Max Stock Level"] || row["maxStockLevel"] || 1000),
            imageUrl: row["Image URL"] || row["imageUrl"] || "",
            isActive: true
          };

          // Find category ID by name
          const categoryName = row["Category"] || row["category"];
          if (categoryName) {
            const categoryId = categoryMap.get(categoryName.toLowerCase());
            if (categoryId) {
              productData.categoryId = categoryId;
            }
          }

          // Validate the product data
          const validatedData = insertProductFormSchema.parse(productData);

          // Convert unitPrice to string for database storage
          const dbProductData = {
            ...validatedData,
            unitPrice: validatedData.unitPrice.toString()
          };

          // Create product
          await storage.createProduct(dbProductData as any);
          results.successful++;

        } catch (error) {
          results.failed++;
          results.errors.push({
            row: i + 2, // Excel row number (accounting for header)
            data: row,
            error: error instanceof Error ? error.message : "Unknown error"
          });
        }
      }

      // Broadcast update to clients
      broadcastToClients({
        type: "PRODUCTS_BULK_UPLOADED",
        data: { results }
      });

      res.json({
        message: `Bulk upload completed. ${results.successful} products added, ${results.failed} failed.`,
        results
      });

    } catch (error) {
      console.error("Error processing bulk upload:", error);
      res.status(500).json({ message: "Failed to process bulk upload" });
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
        categoryId: validatedData.categoryId,
        unitPrice: validatedData.unitPrice.toString(), // Convert number to string for Drizzle decimal type
        currentStock: validatedData.currentStock,
        minStockLevel: validatedData.minStockLevel,
        maxStockLevel: validatedData.maxStockLevel,
        imageUrl: validatedData.imageUrl,
        isActive: validatedData.isActive,
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

      const { productId, type, quantity, reason, notes } = req.body;

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
