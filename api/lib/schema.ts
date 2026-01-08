import { 
  pgTable, 
  text, 
  varchar, 
  timestamp, 
  boolean, 
  integer, 
  real,
  pgEnum,
  uniqueIndex,
  index
} from 'drizzle-orm/pg-core';

// Enums
export const userRoleEnum = pgEnum('user_role', ['ADMIN', 'MANAGER', 'STAFF', 'VIEWER']);
export const stockMovementTypeEnum = pgEnum('stock_movement_type', [
  'INBOUND', 
  'OUTBOUND', 
  'ADJUSTMENT', 
  'RETURN', 
  'TRANSFER', 
  'DAMAGE', 
  'LOSS'
]);
export const transferStatusEnum = pgEnum('transfer_status', ['PENDING', 'IN_TRANSIT', 'COMPLETED', 'CANCELLED']);
export const poStatusEnum = pgEnum('po_status', ['DRAFT', 'SUBMITTED', 'CONFIRMED', 'RECEIVED', 'COMPLETED', 'CANCELLED']);

// User Profiles Table (Clerk Integration)
export const userProfiles = pgTable('user_profiles', {
  id: text('id').primaryKey().notNull(),
  clerkUserId: varchar('clerk_user_id', { length: 255 }).notNull().unique(),
  email: varchar('email', { length: 255 }).notNull(),
  fullName: varchar('full_name', { length: 255 }),
  phone: varchar('phone', { length: 50 }),
  role: userRoleEnum('role').default('VIEWER').notNull(),
  active: boolean('active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  clerkUserIdIdx: uniqueIndex('user_profiles_clerk_user_id_idx').on(table.clerkUserId),
  emailIdx: index('user_profiles_email_idx').on(table.email),
}));

// Users Table (Legacy - keeping for backward compatibility)
export const users = pgTable('users', {
  id: text('id').primaryKey().notNull(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  password: text('password').notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  role: userRoleEnum('role').default('STAFF').notNull(),
  active: boolean('active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  emailIdx: uniqueIndex('users_email_idx').on(table.email),
}));

// Warehouses Table
export const warehouses = pgTable('warehouses', {
  id: text('id').primaryKey().notNull(),
  name: varchar('name', { length: 255 }).notNull().unique(),
  location: text('location').notNull(),
  capacity: integer('capacity').notNull(),
  active: boolean('active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  nameIdx: uniqueIndex('warehouses_name_idx').on(table.name),
}));

// Warehouse Access Table (Updated to use user_profiles)
export const warehouseAccesses = pgTable('warehouse_accesses', {
  id: text('id').primaryKey().notNull(),
  userProfileId: text('user_profile_id').notNull().references(() => userProfiles.id, { onDelete: 'cascade' }),
  warehouseId: text('warehouse_id').notNull().references(() => warehouses.id, { onDelete: 'cascade' }),
  accessLevel: varchar('access_level', { length: 100 }).notNull(), // VIEW, EDIT, MANAGE
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  userWarehouseIdx: uniqueIndex('warehouse_accesses_user_warehouse_idx').on(table.userProfileId, table.warehouseId),
}));

// Products Table
export const products = pgTable('products', {
  id: text('id').primaryKey().notNull(),
  sku: varchar('sku', { length: 100 }).notNull().unique(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  category: varchar('category', { length: 100 }).notNull(),
  unitPrice: real('unit_price').notNull(),
  unit: varchar('unit', { length: 50 }).default('pcs').notNull(),
  active: boolean('active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  skuIdx: uniqueIndex('products_sku_idx').on(table.sku),
  categoryIdx: index('products_category_idx').on(table.category),
}));

// Suppliers Table
export const suppliers = pgTable('suppliers', {
  id: text('id').primaryKey().notNull(),
  name: varchar('name', { length: 255 }).notNull().unique(),
  email: varchar('email', { length: 255 }),
  phone: varchar('phone', { length: 50 }),
  address: text('address'),
  city: varchar('city', { length: 100 }),
  country: varchar('country', { length: 100 }),
  active: boolean('active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  nameIdx: uniqueIndex('suppliers_name_idx').on(table.name),
}));

// Product-Supplier Relationship Table
export const productSuppliers = pgTable('product_suppliers', {
  id: text('id').primaryKey().notNull(),
  productId: text('product_id').notNull().references(() => products.id, { onDelete: 'cascade' }),
  supplierId: text('supplier_id').notNull().references(() => suppliers.id, { onDelete: 'cascade' }),
  supplierSku: varchar('supplier_sku', { length: 100 }),
  leadTime: integer('lead_time'),
  minOrder: integer('min_order'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  productSupplierIdx: uniqueIndex('product_suppliers_product_supplier_idx').on(table.productId, table.supplierId),
}));

// Stocks Table
export const stocks = pgTable('stocks', {
  id: text('id').primaryKey().notNull(),
  productId: text('product_id').notNull().references(() => products.id, { onDelete: 'cascade' }),
  warehouseId: text('warehouse_id').notNull().references(() => warehouses.id, { onDelete: 'cascade' }),
  quantity: integer('quantity').default(0).notNull(),
  reserved: integer('reserved').default(0).notNull(),
  available: integer('available').default(0).notNull(),
  reorderLevel: integer('reorder_level').default(10).notNull(),
  lastCounted: timestamp('last_counted'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  productWarehouseIdx: uniqueIndex('stocks_product_warehouse_idx').on(table.productId, table.warehouseId),
  warehouseIdx: index('stocks_warehouse_idx').on(table.warehouseId),
}));

// Stock Movements Table
export const stockMovements = pgTable('stock_movements', {
  id: text('id').primaryKey().notNull(),
  productId: text('product_id').notNull().references(() => products.id, { onDelete: 'cascade' }),
  quantity: integer('quantity').notNull(),
  movementType: stockMovementTypeEnum('movement_type').notNull(),
  reference: varchar('reference', { length: 255 }),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  productIdx: index('stock_movements_product_idx').on(table.productId),
  createdAtIdx: index('stock_movements_created_at_idx').on(table.createdAt),
}));

// Stock Transfers Table
export const stockTransfers = pgTable('stock_transfers', {
  id: text('id').primaryKey().notNull(),
  fromWarehouseId: text('from_warehouse_id').notNull().references(() => warehouses.id),
  toWarehouseId: text('to_warehouse_id').notNull().references(() => warehouses.id),
  quantity: integer('quantity').notNull(),
  status: transferStatusEnum('status').default('PENDING').notNull(),
  initiatedBy: text('initiated_by').notNull().references(() => users.id),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  fromWarehouseIdx: index('stock_transfers_from_warehouse_idx').on(table.fromWarehouseId),
  toWarehouseIdx: index('stock_transfers_to_warehouse_idx').on(table.toWarehouseId),
}));

// Purchase Orders Table
export const purchaseOrders = pgTable('purchase_orders', {
  id: text('id').primaryKey().notNull(),
  poNumber: varchar('po_number', { length: 100 }).notNull().unique(),
  supplierId: text('supplier_id').notNull().references(() => suppliers.id),
  status: poStatusEnum('status').default('DRAFT').notNull(),
  expectedDate: timestamp('expected_date'),
  receivedDate: timestamp('received_date'),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  poNumberIdx: uniqueIndex('purchase_orders_po_number_idx').on(table.poNumber),
  supplierIdx: index('purchase_orders_supplier_idx').on(table.supplierId),
}));

// Purchase Order Items Table
export const purchaseOrderItems = pgTable('purchase_order_items', {
  id: text('id').primaryKey().notNull(),
  purchaseOrderId: text('purchase_order_id').notNull().references(() => purchaseOrders.id, { onDelete: 'cascade' }),
  productId: text('product_id').notNull(),
  quantity: integer('quantity').notNull(),
  unitPrice: real('unit_price').notNull(),
  receivedQuantity: integer('received_quantity').default(0).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Activities Table (Audit Log)
export const activities = pgTable('activities', {
  id: text('id').primaryKey().notNull(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  action: varchar('action', { length: 255 }).notNull(),
  entityType: varchar('entity_type', { length: 100 }).notNull(),
  entityId: text('entity_id').notNull(),
  oldValue: text('old_value'),
  newValue: text('new_value'),
  details: text('details'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  userIdx: index('activities_user_idx').on(table.userId),
  entityTypeIdx: index('activities_entity_type_idx').on(table.entityType),
  createdAtIdx: index('activities_created_at_idx').on(table.createdAt),
}));

// Chat Conversations Table (for Phase 3)
export const chatConversations = pgTable('chat_conversations', {
  id: text('id').primaryKey().notNull(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  title: varchar('title', { length: 255 }),
  active: boolean('active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  userIdx: index('chat_conversations_user_idx').on(table.userId),
}));

// Chat Messages Table (for Phase 3)
export const chatMessages = pgTable('chat_messages', {
  id: text('id').primaryKey().notNull(),
  conversationId: text('conversation_id').notNull().references(() => chatConversations.id, { onDelete: 'cascade' }),
  role: varchar('role', { length: 50 }).notNull(), // 'user', 'assistant', 'system'
  content: text('content').notNull(),
  toolCalls: text('tool_calls'), // JSON string of tool calls
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  conversationIdx: index('chat_messages_conversation_idx').on(table.conversationId),
  createdAtIdx: index('chat_messages_created_at_idx').on(table.createdAt),
}));

// Tool Calls Table (for tracking AI operations in Phase 3)
export const toolCalls = pgTable('tool_calls', {
  id: text('id').primaryKey().notNull(),
  messageId: text('message_id').notNull().references(() => chatMessages.id, { onDelete: 'cascade' }),
  toolName: varchar('tool_name', { length: 100 }).notNull(),
  arguments: text('arguments').notNull(), // JSON string
  result: text('result'), // JSON string
  status: varchar('status', { length: 50 }).notNull(), // 'pending', 'success', 'error'
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  messageIdx: index('tool_calls_message_idx').on(table.messageId),
}));
