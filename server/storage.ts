import {
  users,
  categories,
  products,
  stockMovements,
  appSettings,
  type User,
  type UpsertUser,
  type Category,
  type InsertCategory,
  type Product,
  type InsertProduct,
  type ProductWithCategory,
  type StockMovement,
  type InsertStockMovement,
  type StockMovementWithDetails,
  type AppSetting,
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, asc, count, sum, and, or, ilike, sql } from "drizzle-orm";

export interface IStorage {
  // User operations (required for Replit Auth)
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  updateUser(id: string, updates: Partial<UpsertUser>): Promise<User>;
  
  // Employee approval operations
  getPendingEmployees(): Promise<User[]>;
  getAllEmployees(): Promise<User[]>;
  updateUserStatus(id: string, status: "pending" | "approved" | "rejected", role?: "admin" | "manager" | "sales_team"): Promise<User>;
  deleteEmployee(id: string): Promise<void>;
  
  // Category operations
  getCategories(): Promise<Category[]>;
  createCategory(category: InsertCategory): Promise<Category>;
  updateCategory(id: number, category: Partial<InsertCategory>): Promise<Category>;
  deleteCategory(id: number): Promise<void>;
  
  // Product operations
  getProducts(filters?: {
    categoryId?: number;
    stockLevel?: "low" | "out" | "all";
    search?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ products: ProductWithCategory[]; total: number }>;
  getProduct(id: number): Promise<ProductWithCategory | undefined>;
  createProduct(product: InsertProduct): Promise<Product>;
  updateProduct(id: number, product: Partial<InsertProduct>): Promise<Product>;
  deleteProduct(id: number): Promise<void>;
  updateProductStock(id: number, newStock: number, userId: string, reason?: string): Promise<void>;
  
  // Stock movement operations
  getStockMovements(productId?: number, limit?: number): Promise<StockMovementWithDetails[]>;
  createStockMovement(movement: InsertStockMovement): Promise<StockMovement>;
  
  // Dashboard statistics
  getDashboardStats(): Promise<{
    totalProducts: number;
    lowStockItems: number;
    outOfStockItems: number;
    totalValue: number;
  }>;
  
  getCompanyStats(): Promise<Array<{
    company: string;
    totalProducts: number;
    lowStockItems: number;
    outOfStockItems: number;
    totalValue: number;
  }>>;
  
  // App settings operations
  getSetting(key: string): Promise<string | null>;
  setSetting(key: string, value: string): Promise<AppSetting>;
  getAllSettings(): Promise<AppSetting[]>;
}

export class DatabaseStorage implements IStorage {
  // User operations (required for Replit Auth)
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values({
        ...userData,
        // First-time users start as pending, existing users keep their status
        status: userData.status || "pending",
      })
      .onConflictDoUpdate({
        target: users.id,
        set: {
          email: userData.email,
          firstName: userData.firstName,
          lastName: userData.lastName,
          profileImageUrl: userData.profileImageUrl,
          updatedAt: new Date(),
          // Don't update status on subsequent logins to preserve approval state
        },
      })
      .returning();
    return user;
  }

  async updateUser(id: string, updates: Partial<UpsertUser>): Promise<User> {
    const [user] = await db
      .update(users)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(users.id, id))
      .returning();
    return user;
  }

  // Employee approval operations
  async getPendingEmployees(): Promise<User[]> {
    return await db
      .select()
      .from(users)
      .where(eq(users.status, "pending"))
      .orderBy(asc(users.createdAt));
  }

  async getAllEmployees(): Promise<User[]> {
    return await db
      .select()
      .from(users)
      .orderBy(asc(users.firstName), asc(users.lastName));
  }

  async deleteEmployee(id: string): Promise<void> {
    // First delete related stock movements to avoid foreign key constraint violation
    await db.delete(stockMovements).where(eq(stockMovements.userId, id));
    // Then delete the employee
    await db.delete(users).where(eq(users.id, id));
  }

  async updateUserStatus(id: string, status: "pending" | "approved" | "rejected", role?: "admin" | "manager" | "sales_team"): Promise<User> {
    const updateData: Record<string, any> = {
      status,
      updatedAt: new Date(),
    };
    
    // Only update role if provided and status is approved
    if (role && status === "approved") {
      updateData.role = role;
    }
    
    const [user] = await db
      .update(users)
      .set(updateData)
      .where(eq(users.id, id))
      .returning();
    return user;
  }

  // Category operations
  async getCategories(): Promise<Category[]> {
    return await db.select().from(categories).orderBy(asc(categories.name));
  }

  async createCategory(category: InsertCategory): Promise<Category> {
    const [newCategory] = await db.insert(categories).values(category).returning();
    return newCategory;
  }

  async updateCategory(id: number, category: Partial<InsertCategory>): Promise<Category> {
    const [updatedCategory] = await db
      .update(categories)
      .set(category)
      .where(eq(categories.id, id))
      .returning();
    return updatedCategory;
  }

  async deleteCategory(id: number): Promise<void> {
    await db.delete(categories).where(eq(categories.id, id));
  }

  // Product operations
  async getProducts(filters?: {
    categoryId?: number;
    stockLevel?: "low" | "out" | "all";
    search?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ products: ProductWithCategory[]; total: number }> {
    const conditions = [eq(products.isActive, true)];
    
    if (filters?.categoryId) {
      conditions.push(eq(products.categoryId, filters.categoryId));
    }
    
    if (filters?.stockLevel === "low") {
      conditions.push(
        and(
          sql`${products.currentStock} <= ${products.minStockLevel}`,
          sql`${products.currentStock} > 0`
        )!
      );
    } else if (filters?.stockLevel === "out") {
      conditions.push(eq(products.currentStock, 0));
    }
    
    if (filters?.search) {
      conditions.push(
        or(
          ilike(products.name, `%${filters.search}%`),
          ilike(products.sku, `%${filters.search}%`)
        )!
      );
    }
    
    const whereClause = and(...conditions);
    
    // Get total count
    const [{ count: totalCount }] = await db
      .select({ count: count() })
      .from(products)
      .where(whereClause);
    
    // Get products with category
    const productsQuery = db
      .select({
        id: products.id,
        name: products.name,
        description: products.description,
        sku: products.sku,
        barcode: products.barcode,
        binLocation: products.binLocation,
        supplierName: products.supplierName,
        categoryId: products.categoryId,
        company: products.company,
        unitPrice: products.unitPrice,
        currentStock: products.currentStock,
        minStockLevel: products.minStockLevel,
        maxStockLevel: products.maxStockLevel,
        imageUrl: products.imageUrl,
        isActive: products.isActive,
        createdAt: products.createdAt,
        updatedAt: products.updatedAt,
        category: {
          id: categories.id,
          name: categories.name,
          description: categories.description,
          createdAt: categories.createdAt,
        },
      })
      .from(products)
      .leftJoin(categories, eq(products.categoryId, categories.id))
      .where(whereClause)
      .orderBy(desc(products.updatedAt));
    
    if (filters?.limit) {
      productsQuery.limit(filters.limit);
    }
    
    if (filters?.offset) {
      productsQuery.offset(filters.offset);
    }
    
    const productResults = await productsQuery;
    
    const productsWithCategory: ProductWithCategory[] = productResults.map(result => ({
      id: result.id,
      name: result.name,
      description: result.description,
      sku: result.sku,
      barcode: result.barcode,
      binLocation: result.binLocation,
      supplierName: result.supplierName,
      categoryId: result.categoryId,
      company: result.company,
      unitPrice: result.unitPrice,
      currentStock: result.currentStock,
      minStockLevel: result.minStockLevel,
      maxStockLevel: result.maxStockLevel,
      imageUrl: result.imageUrl,
      isActive: result.isActive,
      createdAt: result.createdAt,
      updatedAt: result.updatedAt,
      category: result.category && result.category.id ? {
        id: result.category.id,
        name: result.category.name!,
        description: result.category.description,
        createdAt: result.category.createdAt!,
      } : null,
    }));
    
    return {
      products: productsWithCategory,
      total: totalCount,
    };
  }

  async getProduct(id: number): Promise<ProductWithCategory | undefined> {
    const [result] = await db
      .select({
        id: products.id,
        name: products.name,
        description: products.description,
        sku: products.sku,
        barcode: products.barcode,
        binLocation: products.binLocation,
        supplierName: products.supplierName,
        categoryId: products.categoryId,
        company: products.company,
        unitPrice: products.unitPrice,
        currentStock: products.currentStock,
        minStockLevel: products.minStockLevel,
        maxStockLevel: products.maxStockLevel,
        imageUrl: products.imageUrl,
        isActive: products.isActive,
        createdAt: products.createdAt,
        updatedAt: products.updatedAt,
        category: {
          id: categories.id,
          name: categories.name,
          description: categories.description,
          createdAt: categories.createdAt,
        },
      })
      .from(products)
      .leftJoin(categories, eq(products.categoryId, categories.id))
      .where(eq(products.id, id));
    
    if (!result) return undefined;
    
    return {
      id: result.id,
      name: result.name,
      description: result.description,
      sku: result.sku,
      barcode: result.barcode,
      binLocation: result.binLocation,
      supplierName: result.supplierName,
      categoryId: result.categoryId,
      company: result.company,
      unitPrice: result.unitPrice,
      currentStock: result.currentStock,
      minStockLevel: result.minStockLevel,
      maxStockLevel: result.maxStockLevel,
      imageUrl: result.imageUrl,
      isActive: result.isActive,
      createdAt: result.createdAt,
      updatedAt: result.updatedAt,
      category: result.category && result.category.id ? {
        id: result.category.id,
        name: result.category.name!,
        description: result.category.description,
        createdAt: result.category.createdAt!,
      } : null,
    };
  }

  async createProduct(product: InsertProduct): Promise<Product> {
    const [newProduct] = await db.insert(products).values(product).returning();
    return newProduct;
  }

  async updateProduct(id: number, product: Partial<InsertProduct>): Promise<Product> {
    const [updatedProduct] = await db
      .update(products)
      .set({ ...product, updatedAt: new Date() })
      .where(eq(products.id, id))
      .returning();
    return updatedProduct;
  }

  async deleteProduct(id: number): Promise<void> {
    await db.update(products).set({ isActive: false }).where(eq(products.id, id));
  }

  async updateProductStock(id: number, newStock: number, userId: string, reason?: string): Promise<void> {
    await db.transaction(async (tx) => {
      // Get current stock
      const [product] = await tx.select().from(products).where(eq(products.id, id));
      if (!product) throw new Error("Product not found");
      
      const previousStock = product.currentStock;
      const quantity = newStock - previousStock;
      
      // Update product stock
      await tx
        .update(products)
        .set({ currentStock: newStock, updatedAt: new Date() })
        .where(eq(products.id, id));
      
      // Create stock movement record
      await tx.insert(stockMovements).values({
        productId: id,
        userId,
        type: quantity > 0 ? "IN" : quantity < 0 ? "OUT" : "ADJUSTMENT",
        quantity: Math.abs(quantity),
        previousStock,
        newStock,
        reason,
      });
    });
  }

  // Stock movement operations
  async getStockMovements(productId?: number, limit: number = 50): Promise<StockMovementWithDetails[]> {
    const query = db
      .select({
        id: stockMovements.id,
        productId: stockMovements.productId,
        userId: stockMovements.userId,
        type: stockMovements.type,
        quantity: stockMovements.quantity,
        previousStock: stockMovements.previousStock,
        newStock: stockMovements.newStock,
        reason: stockMovements.reason,
        notes: stockMovements.notes,
        invoiceNumber: stockMovements.invoiceNumber,
        invoiceDate: stockMovements.invoiceDate,
        createdAt: stockMovements.createdAt,
        product: {
          id: products.id,
          name: products.name,
          sku: products.sku,
          imageUrl: products.imageUrl,
        },
        user: {
          id: users.id,
          firstName: users.firstName,
          lastName: users.lastName,
        },
      })
      .from(stockMovements)
      .innerJoin(products, eq(stockMovements.productId, products.id))
      .innerJoin(users, eq(stockMovements.userId, users.id))
      .orderBy(desc(stockMovements.createdAt))
      .limit(limit);
    
    if (productId) {
      query.where(eq(stockMovements.productId, productId));
    }
    
    const results = await query;
    
    return results.map(result => ({
      id: result.id,
      productId: result.productId,
      userId: result.userId,
      type: result.type,
      quantity: result.quantity,
      previousStock: result.previousStock,
      newStock: result.newStock,
      reason: result.reason,
      notes: result.notes,
      invoiceNumber: result.invoiceNumber,
      invoiceDate: result.invoiceDate,
      createdAt: result.createdAt,
      product: {
        id: result.product.id,
        name: result.product.name,
        description: null,
        sku: result.product.sku,
        barcode: null,
        binLocation: null,
        categoryId: null,
        unitPrice: "0",
        currentStock: 0,
        minStockLevel: 0,
        maxStockLevel: 0,
        imageUrl: result.product.imageUrl,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      user: {
        id: result.user.id,
        email: "",
        firstName: result.user.firstName,
        lastName: result.user.lastName,
        profileImageUrl: null,
        role: "sales_team",
        status: "approved",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    }));
  }

  async createStockMovement(movement: InsertStockMovement): Promise<StockMovement> {
    const [newMovement] = await db.insert(stockMovements).values(movement).returning();
    return newMovement;
  }

  // Dashboard statistics
  async getDashboardStats(): Promise<{
    totalProducts: number;
    lowStockItems: number;
    outOfStockItems: number;
    totalValue: number;
  }> {
    const [stats] = await db
      .select({
        totalProducts: count(),
        lowStockItems: sum(
          sql`CASE WHEN ${products.currentStock} <= ${products.minStockLevel} AND ${products.currentStock} > 0 THEN 1 ELSE 0 END`
        ),
        outOfStockItems: sum(
          sql`CASE WHEN ${products.currentStock} = 0 THEN 1 ELSE 0 END`
        ),
        totalValue: sum(
          sql`${products.currentStock} * ${products.unitPrice}`
        ),
      })
      .from(products)
      .where(eq(products.isActive, true));
    
    return {
      totalProducts: stats.totalProducts || 0,
      lowStockItems: Number(stats.lowStockItems) || 0,
      outOfStockItems: Number(stats.outOfStockItems) || 0,
      totalValue: Number(stats.totalValue) || 0,
    };
  }

  async getCompanyStats(): Promise<Array<{
    company: string;
    totalProducts: number;
    lowStockItems: number;
    outOfStockItems: number;
    totalValue: number;
  }>> {
    const companies = ["EcoCut", "AGIS", "EcoFast"];
    const results = [];

    for (const company of companies) {
      const [stats] = await db
        .select({
          totalProducts: count(),
          lowStockItems: sum(
            sql`CASE WHEN ${products.currentStock} <= ${products.minStockLevel} AND ${products.currentStock} > 0 THEN 1 ELSE 0 END`
          ),
          outOfStockItems: sum(
            sql`CASE WHEN ${products.currentStock} = 0 THEN 1 ELSE 0 END`
          ),
          totalValue: sum(
            sql`${products.currentStock} * ${products.unitPrice}`
          ),
        })
        .from(products)
        .where(and(eq(products.isActive, true), eq(products.company, company)));

      results.push({
        company,
        totalProducts: stats.totalProducts || 0,
        lowStockItems: Number(stats.lowStockItems) || 0,
        outOfStockItems: Number(stats.outOfStockItems) || 0,
        totalValue: Number(stats.totalValue) || 0,
      });
    }

    return results;
  }

  // App settings operations
  async getSetting(key: string): Promise<string | null> {
    const [setting] = await db
      .select()
      .from(appSettings)
      .where(eq(appSettings.key, key));
    return setting?.value ?? null;
  }

  async setSetting(key: string, value: string): Promise<AppSetting> {
    const [setting] = await db
      .insert(appSettings)
      .values({ key, value })
      .onConflictDoUpdate({
        target: appSettings.key,
        set: { value, updatedAt: new Date() },
      })
      .returning();
    return setting;
  }

  async getAllSettings(): Promise<AppSetting[]> {
    return await db.select().from(appSettings);
  }
}

export const storage = new DatabaseStorage();
