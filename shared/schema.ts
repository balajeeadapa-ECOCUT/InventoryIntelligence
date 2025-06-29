import {
  pgTable,
  text,
  varchar,
  timestamp,
  jsonb,
  index,
  serial,
  integer,
  decimal,
  boolean,
  pgEnum,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";

// Session storage table (required for Replit Auth)
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// User storage table (required for Replit Auth)
export const users = pgTable("users", {
  id: varchar("id").primaryKey().notNull(),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  role: varchar("role").notNull().default("employee"), // admin, manager, employee
  status: varchar("status").notNull().default("pending"), // pending, approved, rejected
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Product categories
export const categories = pgTable("categories", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 100 }).notNull().unique(),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Products
export const products = pgTable("products", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  sku: varchar("sku", { length: 50 }).notNull().unique(),
  barcode: varchar("barcode", { length: 50 }),
  categoryId: integer("category_id").references(() => categories.id),
  unitPrice: decimal("unit_price", { precision: 10, scale: 2 }).notNull(),
  currentStock: integer("current_stock").notNull().default(0),
  minStockLevel: integer("min_stock_level").notNull().default(0),
  maxStockLevel: integer("max_stock_level").notNull().default(1000),
  imageUrl: varchar("image_url"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Stock movement types
export const stockMovementTypeEnum = pgEnum("stock_movement_type", [
  "IN",
  "OUT", 
  "ADJUSTMENT",
  "TRANSFER"
]);

// Stock movements
export const stockMovements = pgTable("stock_movements", {
  id: serial("id").primaryKey(),
  productId: integer("product_id").references(() => products.id).notNull(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  type: stockMovementTypeEnum("type").notNull(),
  quantity: integer("quantity").notNull(),
  previousStock: integer("previous_stock").notNull(),
  newStock: integer("new_stock").notNull(),
  reason: varchar("reason", { length: 255 }),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  stockMovements: many(stockMovements),
}));

export const categoriesRelations = relations(categories, ({ many }) => ({
  products: many(products),
}));

export const productsRelations = relations(products, ({ one, many }) => ({
  category: one(categories, {
    fields: [products.categoryId],
    references: [categories.id],
  }),
  stockMovements: many(stockMovements),
}));

export const stockMovementsRelations = relations(stockMovements, ({ one }) => ({
  product: one(products, {
    fields: [stockMovements.productId],
    references: [products.id],
  }),
  user: one(users, {
    fields: [stockMovements.userId],
    references: [users.id],
  }),
}));

// Insert schemas
export const insertCategorySchema = createInsertSchema(categories).omit({
  id: true,
  createdAt: true,
});

// Client-side schema for form validation (unitPrice as number for API)
export const insertProductFormSchema = z.object({
  name: z.string().min(1, "Product name is required"),
  description: z.string().optional().nullable(),
  sku: z.string().min(1, "SKU is required"),
  barcode: z.string().optional().nullable(),
  categoryId: z.number().optional().nullable(),
  unitPrice: z.number().min(0, "Unit price must be non-negative"),
  currentStock: z.number().min(0, "Stock cannot be negative").default(0),
  minStockLevel: z.number().min(0, "Minimum stock level cannot be negative").default(10),
  maxStockLevel: z.number().min(1, "Maximum stock level must be at least 1").default(1000),
  imageUrl: z.string().optional().nullable(),
  isActive: z.boolean().default(true),
});

// Server-side schema for database insertion (unitPrice as number)
export const insertProductSchema = createInsertSchema(products).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertStockMovementSchema = createInsertSchema(stockMovements).omit({
  id: true,
  createdAt: true,
});

export const upsertUserSchema = createInsertSchema(users).omit({
  createdAt: true,
  updatedAt: true,
});

export const updateUserStatusSchema = z.object({
  status: z.enum(["pending", "approved", "rejected"]),
});

// Types
export type UpsertUser = z.infer<typeof upsertUserSchema>;
export type User = typeof users.$inferSelect;
export type InsertCategory = z.infer<typeof insertCategorySchema>;
export type Category = typeof categories.$inferSelect;
export type InsertProduct = typeof products.$inferInsert;
export type Product = typeof products.$inferSelect;
export type InsertProductForm = z.infer<typeof insertProductFormSchema>;
export type InsertStockMovement = z.infer<typeof insertStockMovementSchema>;
export type StockMovement = typeof stockMovements.$inferSelect;

// Extended types with relations
export type ProductWithCategory = Product & {
  category: Category | null;
};

export type StockMovementWithDetails = StockMovement & {
  product: Product;
  user: User;
};
