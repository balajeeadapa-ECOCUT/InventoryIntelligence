import { pgTable, text, integer, decimal, timestamp, boolean, serial, varchar } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// User roles
export const USER_ROLES = ["admin", "manager", "sales_team"] as const;
export type UserRole = typeof USER_ROLES[number];

// Role permissions
export const ROLE_PERMISSIONS = {
  admin: {
    canViewDashboard: true,
    canViewProducts: true,
    canManageProducts: true,
    canViewStock: true,
    canManageStock: true,
    canViewCategories: true,
    canManageCategories: true,
    canViewReports: true,
    canManageUsers: true,
    canViewSettings: true,
    canManageSettings: true,
    canViewPrices: true,
    canApproveEmployees: true,
  },
  manager: {
    canViewDashboard: true,
    canViewProducts: true,
    canManageProducts: true,
    canViewStock: true,
    canManageStock: true,
    canViewCategories: true,
    canManageCategories: true,
    canViewReports: true,
    canManageUsers: false,
    canViewSettings: true,
    canManageSettings: false,
    canViewPrices: true,
    canApproveEmployees: false,
  },
  sales_team: {
    canViewDashboard: true,
    canViewProducts: true,
    canManageProducts: false,
    canViewStock: true,
    canManageStock: false,
    canViewCategories: true,
    canManageCategories: false,
    canViewReports: false,
    canManageUsers: false,
    canViewSettings: false,
    canManageSettings: false,
    canViewPrices: false,
    canApproveEmployees: false,
  },
} as const;

// Users table
export const users = pgTable("users", {
  id: varchar("id", { length: 255 }).primaryKey(),
  email: varchar("email", { length: 255 }).notNull(),
  firstName: varchar("first_name", { length: 255 }),
  lastName: varchar("last_name", { length: 255 }),
  profileImageUrl: text("profile_image_url"),
  role: varchar("role", { length: 50 }).default("sales_team").notNull(),
  status: varchar("status", { length: 50 }).default("pending").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type UpsertUser = typeof users.$inferInsert;

// Categories table
export const categories = pgTable("categories", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type Category = typeof categories.$inferSelect;
export type InsertCategory = typeof categories.$inferInsert;
export const insertCategorySchema = createInsertSchema(categories).omit({ id: true, createdAt: true });

// Products table
export const products = pgTable("products", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  sku: varchar("sku", { length: 100 }).notNull().unique(),
  barcode: varchar("barcode", { length: 100 }),
  binLocation: varchar("bin_location", { length: 100 }),
  categoryId: integer("category_id").references(() => categories.id),
  unitPrice: decimal("unit_price", { precision: 10, scale: 2 }).notNull(),
  currentStock: integer("current_stock").default(0).notNull(),
  minStockLevel: integer("min_stock_level").default(10),
  maxStockLevel: integer("max_stock_level").default(100),
  imageUrl: text("image_url"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type Product = typeof products.$inferSelect;
export type InsertProduct = typeof products.$inferInsert;
export const insertProductSchema = createInsertSchema(products).omit({ id: true, createdAt: true, updatedAt: true });
export const insertProductFormSchema = insertProductSchema.extend({
  unitPrice: z.string().or(z.number()),
  currentStock: z.string().or(z.number()).optional(),
  minStockLevel: z.string().or(z.number()).optional(),
  maxStockLevel: z.string().or(z.number()).optional(),
  categoryId: z.string().or(z.number()).nullable().optional(),
});

export type ProductWithCategory = Product & {
  category?: Category | null;
};

// Stock movements table
export const stockMovements = pgTable("stock_movements", {
  id: serial("id").primaryKey(),
  productId: integer("product_id").references(() => products.id).notNull(),
  userId: varchar("user_id", { length: 255 }).references(() => users.id).notNull(),
  movementType: varchar("movement_type", { length: 50 }).notNull(),
  quantity: integer("quantity").notNull(),
  previousStock: integer("previous_stock").notNull(),
  newStock: integer("new_stock").notNull(),
  reason: text("reason"),
  invoiceNumber: varchar("invoice_number", { length: 100 }),
  invoiceDate: timestamp("invoice_date"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type StockMovement = typeof stockMovements.$inferSelect;
export type InsertStockMovement = typeof stockMovements.$inferInsert;
export const insertStockMovementSchema = createInsertSchema(stockMovements).omit({ id: true, createdAt: true });

export type StockMovementWithDetails = StockMovement & {
  product?: Product | null;
  user?: User | null;
};

// App settings table
export const appSettings = pgTable("app_settings", {
  id: serial("id").primaryKey(),
  key: varchar("key", { length: 255 }).notNull().unique(),
  value: text("value").notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type AppSetting = typeof appSettings.$inferSelect;
export type InsertAppSetting = typeof appSettings.$inferInsert;
