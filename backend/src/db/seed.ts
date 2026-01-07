import { db } from './client';
import {
  users,
  warehouses,
  products,
  suppliers,
  productSuppliers,
  stocks,
  purchaseOrders,
  purchaseOrderItems,
} from './schema';
import { v4 as uuidv4 } from 'uuid';

async function seed() {
  console.log('🌱 Starting database seed...');

  try {
    // Create users with different roles
    console.log('Creating users...');
    const [adminUser, managerUser, staffUser] = await db.insert(users).values([
      {
        id: uuidv4(),
        email: 'admin@inventory.com',
        password: '$2a$10$hashedpassword123', // In production, use proper hashing
        name: 'Admin User',
        role: 'ADMIN',
        active: true,
      },
      {
        id: uuidv4(),
        email: 'manager@inventory.com',
        password: '$2a$10$hashedpassword123',
        name: 'Manager User',
        role: 'MANAGER',
        active: true,
      },
      {
        id: uuidv4(),
        email: 'staff@inventory.com',
        password: '$2a$10$hashedpassword123',
        name: 'Staff User',
        role: 'STAFF',
        active: true,
      },
    ]).returning();

    console.log(`✅ Created ${3} users`);

    // Create warehouses
    console.log('Creating warehouses...');
    const [warehouse1, warehouse2, warehouse3] = await db.insert(warehouses).values([
      {
        id: uuidv4(),
        name: 'Main Warehouse',
        location: '123 Industrial Blvd, New York, NY 10001',
        capacity: 10000,
        active: true,
      },
      {
        id: uuidv4(),
        name: 'West Coast Distribution Center',
        location: '456 Tech Drive, San Francisco, CA 94105',
        capacity: 15000,
        active: true,
      },
      {
        id: uuidv4(),
        name: 'Midwest Storage Facility',
        location: '789 Commerce St, Chicago, IL 60601',
        capacity: 8000,
        active: true,
      },
    ]).returning();

    console.log(`✅ Created ${3} warehouses`);

    // Create suppliers
    console.log('Creating suppliers...');
    const [supplier1, supplier2, supplier3] = await db.insert(suppliers).values([
      {
        id: uuidv4(),
        name: 'Global Electronics Supply',
        email: 'orders@globalelectronics.com',
        phone: '+1-555-0100',
        address: '100 Electronics Ave',
        city: 'Austin',
        country: 'USA',
        active: true,
      },
      {
        id: uuidv4(),
        name: 'Precision Parts Co',
        email: 'sales@precisionparts.com',
        phone: '+1-555-0200',
        address: '200 Manufacturing Way',
        city: 'Detroit',
        country: 'USA',
        active: true,
      },
      {
        id: uuidv4(),
        name: 'Industrial Components Inc',
        email: 'contact@industrial.com',
        phone: '+1-555-0300',
        address: '300 Industrial Park',
        city: 'Cleveland',
        country: 'USA',
        active: true,
      },
    ]).returning();

    console.log(`✅ Created ${3} suppliers`);

    // Create products
    console.log('Creating products...');
    const productData = [
      { sku: 'BEAR-001', name: 'Bearing 6205', category: 'Bearings', unitPrice: 12.50, unit: 'pcs' },
      { sku: 'BEAR-002', name: 'Bearing 6206', category: 'Bearings', unitPrice: 15.75, unit: 'pcs' },
      { sku: 'BOLT-M8', name: 'M8 Hex Bolt', category: 'Fasteners', unitPrice: 0.25, unit: 'pcs' },
      { sku: 'BOLT-M10', name: 'M10 Hex Bolt', category: 'Fasteners', unitPrice: 0.35, unit: 'pcs' },
      { sku: 'MOTOR-1HP', name: '1HP Electric Motor', category: 'Motors', unitPrice: 125.00, unit: 'pcs' },
      { sku: 'MOTOR-3HP', name: '3HP Electric Motor', category: 'Motors', unitPrice: 285.00, unit: 'pcs' },
      { sku: 'SWITCH-10A', name: '10A Toggle Switch', category: 'Electrical', unitPrice: 8.50, unit: 'pcs' },
      { sku: 'SWITCH-20A', name: '20A Toggle Switch', category: 'Electrical', unitPrice: 12.00, unit: 'pcs' },
      { sku: 'CABLE-16AWG', name: '16 AWG Cable', category: 'Electrical', unitPrice: 1.50, unit: 'meter' },
      { sku: 'CABLE-12AWG', name: '12 AWG Cable', category: 'Electrical', unitPrice: 2.25, unit: 'meter' },
      { sku: 'WASHER-M8', name: 'M8 Washer', category: 'Fasteners', unitPrice: 0.10, unit: 'pcs' },
      { sku: 'WASHER-M10', name: 'M10 Washer', category: 'Fasteners', unitPrice: 0.15, unit: 'pcs' },
      { sku: 'SEAL-NBR', name: 'NBR O-Ring Seal', category: 'Seals', unitPrice: 3.50, unit: 'pcs' },
      { sku: 'SEAL-VIT', name: 'Viton O-Ring Seal', category: 'Seals', unitPrice: 6.75, unit: 'pcs' },
      { sku: 'GREASE-500G', name: 'Industrial Grease 500g', category: 'Lubricants', unitPrice: 9.99, unit: 'unit' },
    ];

    const createdProducts = await db.insert(products).values(
      productData.map(p => ({
        id: uuidv4(),
        sku: p.sku,
        name: p.name,
        description: `High-quality ${p.name} for industrial applications`,
        category: p.category,
        unitPrice: p.unitPrice,
        unit: p.unit,
        active: true,
      }))
    ).returning();

    console.log(`✅ Created ${createdProducts.length} products`);

    // Create product-supplier relationships
    console.log('Creating product-supplier relationships...');
    const productSupplierData = [];
    createdProducts.forEach((product, idx) => {
      const supplier = [supplier1, supplier2, supplier3][idx % 3];
      productSupplierData.push({
        id: uuidv4(),
        productId: product.id,
        supplierId: supplier.id,
        supplierSku: `SUP-${product.sku}`,
        leadTime: 7 + (idx % 3) * 7, // 7, 14, or 21 days
        minOrder: 10 + (idx % 5) * 10, // 10, 20, 30, 40, or 50
      });
    });

    await db.insert(productSuppliers).values(productSupplierData);
    console.log(`✅ Created ${productSupplierData.length} product-supplier relationships`);

    // Create stock entries
    console.log('Creating stock entries...');
    const stockData = [];
    createdProducts.forEach((product, idx) => {
      [warehouse1, warehouse2, warehouse3].forEach((warehouse, wIdx) => {
        const quantity = 50 + (idx * 10) + (wIdx * 20);
        const reserved = Math.floor(quantity * 0.1); // 10% reserved
        stockData.push({
          id: uuidv4(),
          productId: product.id,
          warehouseId: warehouse.id,
          quantity,
          reserved,
          available: quantity - reserved,
          reorderLevel: 10 + (idx % 3) * 5,
          lastCounted: new Date(Date.now() - (wIdx * 86400000)), // Last counted 0-2 days ago
        });
      });
    });

    await db.insert(stocks).values(stockData);
    console.log(`✅ Created ${stockData.length} stock entries`);

    // Create purchase orders
    console.log('Creating purchase orders...');
    const [po1, po2] = await db.insert(purchaseOrders).values([
      {
        id: uuidv4(),
        poNumber: 'PO-2024-001',
        supplierId: supplier1.id,
        status: 'SUBMITTED',
        expectedDate: new Date(Date.now() + 7 * 86400000), // 7 days from now
        notes: 'Urgent order for bearings',
      },
      {
        id: uuidv4(),
        poNumber: 'PO-2024-002',
        supplierId: supplier2.id,
        status: 'CONFIRMED',
        expectedDate: new Date(Date.now() + 14 * 86400000), // 14 days from now
        notes: 'Regular monthly fasteners order',
      },
    ]).returning();

    console.log(`✅ Created ${2} purchase orders`);

    // Create purchase order items
    console.log('Creating purchase order items...');
    const poItemData = [
      {
        id: uuidv4(),
        purchaseOrderId: po1.id,
        productId: createdProducts[0].id, // BEAR-001
        quantity: 100,
        unitPrice: 12.50,
        receivedQuantity: 0,
      },
      {
        id: uuidv4(),
        purchaseOrderId: po1.id,
        productId: createdProducts[1].id, // BEAR-002
        quantity: 150,
        unitPrice: 15.75,
        receivedQuantity: 0,
      },
      {
        id: uuidv4(),
        purchaseOrderId: po2.id,
        productId: createdProducts[2].id, // BOLT-M8
        quantity: 500,
        unitPrice: 0.25,
        receivedQuantity: 250,
      },
      {
        id: uuidv4(),
        purchaseOrderId: po2.id,
        productId: createdProducts[3].id, // BOLT-M10
        quantity: 300,
        unitPrice: 0.35,
        receivedQuantity: 300,
      },
    ];

    await db.insert(purchaseOrderItems).values(poItemData);
    console.log(`✅ Created ${poItemData.length} purchase order items`);

    console.log('');
    console.log('🎉 Database seeding completed successfully!');
    console.log('');
    console.log('📊 Summary:');
    console.log(`   - Users: 3`);
    console.log(`   - Warehouses: 3`);
    console.log(`   - Suppliers: 3`);
    console.log(`   - Products: ${createdProducts.length}`);
    console.log(`   - Product-Supplier relationships: ${productSupplierData.length}`);
    console.log(`   - Stock entries: ${stockData.length}`);
    console.log(`   - Purchase orders: 2`);
    console.log(`   - Purchase order items: ${poItemData.length}`);
  } catch (error) {
    console.error('❌ Error seeding database:', error);
    throw error;
  }
}

// Run seed if called directly
if (require.main === module) {
  seed()
    .then(() => {
      console.log('✅ Seed completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Seed failed:', error);
      process.exit(1);
    });
}

export default seed;
