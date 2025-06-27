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
import { z } from "zod";

export async function registerRoutes(app: Express): Promise<Server> {
  // Auth middleware
  await setupAuth(app);

  // Auth routes
  app.get('/api/auth/user', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Initialize sample data
  app.post('/api/init-sample-data', isAuthenticated, async (req: any, res) => {
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
        unitPrice: validatedData.unitPrice, // Keep as string for Drizzle decimal type
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
        ...(validatedData.unitPrice && { unitPrice: validatedData.unitPrice }),
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
