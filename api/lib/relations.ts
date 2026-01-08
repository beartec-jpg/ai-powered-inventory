import { relations } from 'drizzle-orm';
import {
  users,
  userProfiles,
  warehouses,
  warehouseAccesses,
  products,
  suppliers,
  productSuppliers,
  stocks,
  stockMovements,
  stockTransfers,
  purchaseOrders,
  purchaseOrderItems,
  activities,
  chatConversations,
  chatMessages,
  toolCalls,
} from './schema.js';

// User Relations
export const usersRelations = relations(users, ({ many }) => ({
  warehouseAccesses: many(warehouseAccesses),
  activities: many(activities),
  stockTransfers: many(stockTransfers),
  chatConversations: many(chatConversations),
}));

// Warehouse Relations
export const warehousesRelations = relations(warehouses, ({ many }) => ({
  stocks: many(stocks),
  accesses: many(warehouseAccesses),
  transfersFrom: many(stockTransfers, { relationName: 'fromWarehouse' }),
  transfersTo: many(stockTransfers, { relationName: 'toWarehouse' }),
}));

// Warehouse Access Relations
export const warehouseAccessesRelations = relations(warehouseAccesses, ({ one }) => ({
  user: one(userProfiles, {
    fields: [warehouseAccesses.userProfileId],
    references: [userProfiles.id],
  }),
  warehouse: one(warehouses, {
    fields: [warehouseAccesses.warehouseId],
    references: [warehouses.id],
  }),
}));

// Product Relations
export const productsRelations = relations(products, ({ many }) => ({
  stocks: many(stocks),
  movements: many(stockMovements),
  suppliers: many(productSuppliers),
}));

// Supplier Relations
export const suppliersRelations = relations(suppliers, ({ many }) => ({
  products: many(productSuppliers),
  orders: many(purchaseOrders),
}));

// Product-Supplier Relations
export const productSuppliersRelations = relations(productSuppliers, ({ one }) => ({
  product: one(products, {
    fields: [productSuppliers.productId],
    references: [products.id],
  }),
  supplier: one(suppliers, {
    fields: [productSuppliers.supplierId],
    references: [suppliers.id],
  }),
}));

// Stock Relations
export const stocksRelations = relations(stocks, ({ one }) => ({
  product: one(products, {
    fields: [stocks.productId],
    references: [products.id],
  }),
  warehouse: one(warehouses, {
    fields: [stocks.warehouseId],
    references: [warehouses.id],
  }),
}));

// Stock Movement Relations
export const stockMovementsRelations = relations(stockMovements, ({ one }) => ({
  product: one(products, {
    fields: [stockMovements.productId],
    references: [products.id],
  }),
}));

// Stock Transfer Relations
export const stockTransfersRelations = relations(stockTransfers, ({ one }) => ({
  fromWarehouse: one(warehouses, {
    fields: [stockTransfers.fromWarehouseId],
    references: [warehouses.id],
    relationName: 'fromWarehouse',
  }),
  toWarehouse: one(warehouses, {
    fields: [stockTransfers.toWarehouseId],
    references: [warehouses.id],
    relationName: 'toWarehouse',
  }),
  user: one(users, {
    fields: [stockTransfers.initiatedBy],
    references: [users.id],
  }),
}));

// Purchase Order Relations
export const purchaseOrdersRelations = relations(purchaseOrders, ({ one, many }) => ({
  supplier: one(suppliers, {
    fields: [purchaseOrders.supplierId],
    references: [suppliers.id],
  }),
  items: many(purchaseOrderItems),
}));

// Purchase Order Item Relations
export const purchaseOrderItemsRelations = relations(purchaseOrderItems, ({ one }) => ({
  purchaseOrder: one(purchaseOrders, {
    fields: [purchaseOrderItems.purchaseOrderId],
    references: [purchaseOrders.id],
  }),
}));

// Activity Relations
export const activitiesRelations = relations(activities, ({ one }) => ({
  user: one(users, {
    fields: [activities.userId],
    references: [users.id],
  }),
}));

// Chat Conversation Relations
export const chatConversationsRelations = relations(chatConversations, ({ one, many }) => ({
  user: one(users, {
    fields: [chatConversations.userId],
    references: [users.id],
  }),
  messages: many(chatMessages),
}));

// Chat Message Relations
export const chatMessagesRelations = relations(chatMessages, ({ one, many }) => ({
  conversation: one(chatConversations, {
    fields: [chatMessages.conversationId],
    references: [chatConversations.id],
  }),
  toolCalls: many(toolCalls),
}));

// Tool Call Relations
export const toolCallsRelations = relations(toolCalls, ({ one }) => ({
  message: one(chatMessages, {
    fields: [toolCalls.messageId],
    references: [chatMessages.id],
  }),
}));
