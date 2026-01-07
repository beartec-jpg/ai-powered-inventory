import { PrismaClient, UserRole, StockMovementType, TransferStatus, POStatus } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seeding...');

  // Clear existing data (in reverse order of dependencies)
  console.log('🗑️  Clearing existing data...');
  await prisma.activity.deleteMany();
  await prisma.purchaseOrderItem.deleteMany();
  await prisma.purchaseOrder.deleteMany();
  await prisma.stockTransfer.deleteMany();
  await prisma.stockMovement.deleteMany();
  await prisma.stock.deleteMany();
  await prisma.productSupplier.deleteMany();
  await prisma.product.deleteMany();
  await prisma.supplier.deleteMany();
  await prisma.warehouseAccess.deleteMany();
  await prisma.warehouse.deleteMany();
  await prisma.user.deleteMany();

  // Seed Users with different roles
  console.log('👥 Creating users...');
  const hashedPassword = await bcrypt.hash('password123', 10);
  
  const adminUser = await prisma.user.create({
    data: {
      email: 'admin@inventory.com',
      password: hashedPassword,
      name: 'Admin User',
      role: UserRole.ADMIN,
      active: true,
    },
  });

  const managerUser = await prisma.user.create({
    data: {
      email: 'manager@inventory.com',
      password: hashedPassword,
      name: 'Manager User',
      role: UserRole.MANAGER,
      active: true,
    },
  });

  const staffUser = await prisma.user.create({
    data: {
      email: 'staff@inventory.com',
      password: hashedPassword,
      name: 'Staff User',
      role: UserRole.STAFF,
      active: true,
    },
  });

  console.log(`✅ Created ${3} users`);

  // Seed Warehouses
  console.log('🏭 Creating warehouses...');
  const warehouseMain = await prisma.warehouse.create({
    data: {
      name: 'Main Warehouse',
      location: '123 Industrial Ave, New York, NY 10001',
      capacity: 10000,
      active: true,
    },
  });

  const warehouseWest = await prisma.warehouse.create({
    data: {
      name: 'West Coast Distribution',
      location: '456 Harbor Blvd, Los Angeles, CA 90001',
      capacity: 7500,
      active: true,
    },
  });

  const warehouseEast = await prisma.warehouse.create({
    data: {
      name: 'East Coast Hub',
      location: '789 Commerce St, Miami, FL 33101',
      capacity: 5000,
      active: true,
    },
  });

  console.log(`✅ Created ${3} warehouses`);

  // Create Warehouse Access
  console.log('🔑 Creating warehouse access...');
  await prisma.warehouseAccess.createMany({
    data: [
      { userId: managerUser.id, warehouseId: warehouseMain.id, role: 'MANAGER' },
      { userId: managerUser.id, warehouseId: warehouseWest.id, role: 'MANAGER' },
      { userId: staffUser.id, warehouseId: warehouseMain.id, role: 'STAFF' },
    ],
  });

  // Seed Suppliers
  console.log('🏢 Creating suppliers...');
  const supplierElectronics = await prisma.supplier.create({
    data: {
      name: 'TechSupply Co.',
      email: 'orders@techsupply.com',
      phone: '+1-555-0101',
      address: '100 Tech Park',
      city: 'San Francisco',
      country: 'USA',
      active: true,
    },
  });

  const supplierFurniture = await prisma.supplier.create({
    data: {
      name: 'Furniture Direct Ltd.',
      email: 'sales@furnituredirect.com',
      phone: '+1-555-0202',
      address: '200 Furniture Way',
      city: 'Chicago',
      country: 'USA',
      active: true,
    },
  });

  const supplierOffice = await prisma.supplier.create({
    data: {
      name: 'Office Essentials Inc.',
      email: 'info@officeessentials.com',
      phone: '+1-555-0303',
      address: '300 Business Blvd',
      city: 'Boston',
      country: 'USA',
      active: true,
    },
  });

  console.log(`✅ Created ${3} suppliers`);

  // Seed Products
  console.log('📦 Creating products...');
  
  // Electronics
  const laptop = await prisma.product.create({
    data: {
      sku: 'ELEC-LAP-001',
      name: 'Business Laptop 15"',
      description: 'High-performance laptop for business use',
      category: 'Electronics',
      unitPrice: 899.99,
      unit: 'pcs',
      active: true,
    },
  });

  const monitor = await prisma.product.create({
    data: {
      sku: 'ELEC-MON-001',
      name: '24" LED Monitor',
      description: 'Full HD LED monitor',
      category: 'Electronics',
      unitPrice: 199.99,
      unit: 'pcs',
      active: true,
    },
  });

  const keyboard = await prisma.product.create({
    data: {
      sku: 'ELEC-KEY-001',
      name: 'Wireless Keyboard',
      description: 'Ergonomic wireless keyboard',
      category: 'Electronics',
      unitPrice: 49.99,
      unit: 'pcs',
      active: true,
    },
  });

  const mouse = await prisma.product.create({
    data: {
      sku: 'ELEC-MOU-001',
      name: 'Wireless Mouse',
      description: 'Optical wireless mouse',
      category: 'Electronics',
      unitPrice: 29.99,
      unit: 'pcs',
      active: true,
    },
  });

  // Furniture
  const deskChair = await prisma.product.create({
    data: {
      sku: 'FURN-CHA-001',
      name: 'Executive Office Chair',
      description: 'Ergonomic leather office chair',
      category: 'Furniture',
      unitPrice: 299.99,
      unit: 'pcs',
      active: true,
    },
  });

  const desk = await prisma.product.create({
    data: {
      sku: 'FURN-DSK-001',
      name: 'Standing Desk',
      description: 'Adjustable height standing desk',
      category: 'Furniture',
      unitPrice: 499.99,
      unit: 'pcs',
      active: true,
    },
  });

  const cabinet = await prisma.product.create({
    data: {
      sku: 'FURN-CAB-001',
      name: 'Filing Cabinet',
      description: '4-drawer metal filing cabinet',
      category: 'Furniture',
      unitPrice: 149.99,
      unit: 'pcs',
      active: true,
    },
  });

  // Office Supplies
  const paper = await prisma.product.create({
    data: {
      sku: 'OFFC-PAP-001',
      name: 'Printer Paper A4',
      description: '500 sheets white printer paper',
      category: 'Office Supplies',
      unitPrice: 4.99,
      unit: 'ream',
      active: true,
    },
  });

  const pens = await prisma.product.create({
    data: {
      sku: 'OFFC-PEN-001',
      name: 'Ballpoint Pens (Box of 50)',
      description: 'Blue ink ballpoint pens',
      category: 'Office Supplies',
      unitPrice: 12.99,
      unit: 'box',
      active: true,
    },
  });

  const notebooks = await prisma.product.create({
    data: {
      sku: 'OFFC-NOT-001',
      name: 'Spiral Notebooks (Pack of 5)',
      description: 'A5 spiral notebooks',
      category: 'Office Supplies',
      unitPrice: 9.99,
      unit: 'pack',
      active: true,
    },
  });

  const stapler = await prisma.product.create({
    data: {
      sku: 'OFFC-STA-001',
      name: 'Heavy Duty Stapler',
      description: 'Metal heavy duty stapler',
      category: 'Office Supplies',
      unitPrice: 19.99,
      unit: 'pcs',
      active: true,
    },
  });

  const folders = await prisma.product.create({
    data: {
      sku: 'OFFC-FOL-001',
      name: 'File Folders (Pack of 100)',
      description: 'Manila file folders',
      category: 'Office Supplies',
      unitPrice: 14.99,
      unit: 'pack',
      active: true,
    },
  });

  const tape = await prisma.product.create({
    data: {
      sku: 'OFFC-TAP-001',
      name: 'Scotch Tape (6 Pack)',
      description: 'Clear adhesive tape',
      category: 'Office Supplies',
      unitPrice: 8.99,
      unit: 'pack',
      active: true,
    },
  });

  const markers = await prisma.product.create({
    data: {
      sku: 'OFFC-MAR-001',
      name: 'Whiteboard Markers (Set of 12)',
      description: 'Assorted color markers',
      category: 'Office Supplies',
      unitPrice: 15.99,
      unit: 'set',
      active: true,
    },
  });

  const calculator = await prisma.product.create({
    data: {
      sku: 'OFFC-CAL-001',
      name: 'Scientific Calculator',
      description: 'Advanced scientific calculator',
      category: 'Office Supplies',
      unitPrice: 24.99,
      unit: 'pcs',
      active: true,
    },
  });

  console.log(`✅ Created ${15} products`);

  // Create Product-Supplier Relationships
  console.log('🔗 Creating product-supplier relationships...');
  await prisma.productSupplier.createMany({
    data: [
      { productId: laptop.id, supplierId: supplierElectronics.id, supplierSku: 'TS-LAP-BUS-15', leadTime: 7, minOrder: 5 },
      { productId: monitor.id, supplierId: supplierElectronics.id, supplierSku: 'TS-MON-24-LED', leadTime: 5, minOrder: 10 },
      { productId: keyboard.id, supplierId: supplierElectronics.id, supplierSku: 'TS-KEY-WLSS', leadTime: 3, minOrder: 20 },
      { productId: mouse.id, supplierId: supplierElectronics.id, supplierSku: 'TS-MOU-WLSS', leadTime: 3, minOrder: 20 },
      { productId: deskChair.id, supplierId: supplierFurniture.id, supplierSku: 'FD-CHAIR-EXEC', leadTime: 14, minOrder: 2 },
      { productId: desk.id, supplierId: supplierFurniture.id, supplierSku: 'FD-DESK-STAND', leadTime: 14, minOrder: 2 },
      { productId: cabinet.id, supplierId: supplierFurniture.id, supplierSku: 'FD-CAB-FILE-4', leadTime: 10, minOrder: 5 },
      { productId: paper.id, supplierId: supplierOffice.id, supplierSku: 'OE-PAP-A4-500', leadTime: 2, minOrder: 100 },
      { productId: pens.id, supplierId: supplierOffice.id, supplierSku: 'OE-PEN-BP-50', leadTime: 2, minOrder: 50 },
      { productId: notebooks.id, supplierId: supplierOffice.id, supplierSku: 'OE-NOT-A5-5', leadTime: 3, minOrder: 30 },
      { productId: stapler.id, supplierId: supplierOffice.id, supplierSku: 'OE-STA-HD', leadTime: 3, minOrder: 20 },
      { productId: folders.id, supplierId: supplierOffice.id, supplierSku: 'OE-FOL-MAN-100', leadTime: 2, minOrder: 50 },
      { productId: tape.id, supplierId: supplierOffice.id, supplierSku: 'OE-TAP-CLR-6', leadTime: 2, minOrder: 100 },
      { productId: markers.id, supplierId: supplierOffice.id, supplierSku: 'OE-MAR-WB-12', leadTime: 3, minOrder: 30 },
      { productId: calculator.id, supplierId: supplierOffice.id, supplierSku: 'OE-CAL-SCI', leadTime: 5, minOrder: 15 },
    ],
  });

  // Create Stock Entries
  console.log('📊 Creating stock entries...');
  await prisma.stock.createMany({
    data: [
      // Main Warehouse
      { productId: laptop.id, warehouseId: warehouseMain.id, quantity: 45, reserved: 5, available: 40, reorderLevel: 20 },
      { productId: monitor.id, warehouseId: warehouseMain.id, quantity: 120, reserved: 10, available: 110, reorderLevel: 30 },
      { productId: keyboard.id, warehouseId: warehouseMain.id, quantity: 200, reserved: 20, available: 180, reorderLevel: 50 },
      { productId: mouse.id, warehouseId: warehouseMain.id, quantity: 180, reserved: 15, available: 165, reorderLevel: 50 },
      { productId: deskChair.id, warehouseId: warehouseMain.id, quantity: 30, reserved: 3, available: 27, reorderLevel: 10 },
      { productId: desk.id, warehouseId: warehouseMain.id, quantity: 25, reserved: 2, available: 23, reorderLevel: 8 },
      { productId: cabinet.id, warehouseId: warehouseMain.id, quantity: 40, reserved: 4, available: 36, reorderLevel: 15 },
      { productId: paper.id, warehouseId: warehouseMain.id, quantity: 500, reserved: 50, available: 450, reorderLevel: 200 },
      { productId: pens.id, warehouseId: warehouseMain.id, quantity: 8, reserved: 2, available: 6, reorderLevel: 30 },
      { productId: notebooks.id, warehouseId: warehouseMain.id, quantity: 150, reserved: 15, available: 135, reorderLevel: 50 },
      
      // West Coast Warehouse
      { productId: laptop.id, warehouseId: warehouseWest.id, quantity: 30, reserved: 3, available: 27, reorderLevel: 15 },
      { productId: monitor.id, warehouseId: warehouseWest.id, quantity: 80, reserved: 8, available: 72, reorderLevel: 25 },
      { productId: keyboard.id, warehouseId: warehouseWest.id, quantity: 150, reserved: 10, available: 140, reorderLevel: 40 },
      { productId: mouse.id, warehouseId: warehouseWest.id, quantity: 120, reserved: 8, available: 112, reorderLevel: 40 },
      { productId: paper.id, warehouseId: warehouseWest.id, quantity: 300, reserved: 30, available: 270, reorderLevel: 150 },
      
      // East Coast Warehouse
      { productId: deskChair.id, warehouseId: warehouseEast.id, quantity: 20, reserved: 2, available: 18, reorderLevel: 8 },
      { productId: desk.id, warehouseId: warehouseEast.id, quantity: 15, reserved: 1, available: 14, reorderLevel: 5 },
      { productId: cabinet.id, warehouseId: warehouseEast.id, quantity: 25, reserved: 2, available: 23, reorderLevel: 10 },
      { productId: stapler.id, warehouseId: warehouseEast.id, quantity: 100, reserved: 5, available: 95, reorderLevel: 30 },
      { productId: folders.id, warehouseId: warehouseEast.id, quantity: 200, reserved: 15, available: 185, reorderLevel: 75 },
    ],
  });

  console.log(`✅ Created ${20} stock entries`);

  // Create Stock Movements
  console.log('📝 Creating stock movements...');
  await prisma.stockMovement.createMany({
    data: [
      { productId: laptop.id, quantity: 50, movementType: StockMovementType.INBOUND, reference: 'PO-2024-001', notes: 'Initial purchase order' },
      { productId: monitor.id, quantity: 200, movementType: StockMovementType.INBOUND, reference: 'PO-2024-002', notes: 'Bulk order' },
      { productId: keyboard.id, quantity: 350, movementType: StockMovementType.INBOUND, reference: 'PO-2024-003', notes: 'Stock replenishment' },
      { productId: paper.id, quantity: 800, movementType: StockMovementType.INBOUND, reference: 'PO-2024-004', notes: 'Monthly supply' },
      { productId: laptop.id, quantity: -5, movementType: StockMovementType.OUTBOUND, reference: 'SO-2024-001', notes: 'Corporate order' },
      { productId: keyboard.id, quantity: 2, movementType: StockMovementType.ADJUSTMENT, notes: 'Inventory count adjustment' },
    ],
  });

  // Create Purchase Orders
  console.log('🛒 Creating purchase orders...');
  const po1 = await prisma.purchaseOrder.create({
    data: {
      poNumber: 'PO-2024-001',
      supplierId: supplierElectronics.id,
      status: POStatus.COMPLETED,
      expectedDate: new Date('2024-01-15'),
      receivedDate: new Date('2024-01-14'),
      notes: 'Initial electronics order',
    },
  });

  const po2 = await prisma.purchaseOrder.create({
    data: {
      poNumber: 'PO-2024-002',
      supplierId: supplierFurniture.id,
      status: POStatus.CONFIRMED,
      expectedDate: new Date('2024-02-01'),
      notes: 'Furniture for new office',
    },
  });

  const po3 = await prisma.purchaseOrder.create({
    data: {
      poNumber: 'PO-2024-003',
      supplierId: supplierOffice.id,
      status: POStatus.SUBMITTED,
      expectedDate: new Date('2024-01-25'),
      notes: 'Monthly office supplies',
    },
  });

  // Create Purchase Order Items
  console.log('📋 Creating purchase order items...');
  await prisma.purchaseOrderItem.createMany({
    data: [
      { purchaseOrderId: po1.id, productId: laptop.id, quantity: 50, unitPrice: 850.00, receivedQuantity: 50 },
      { purchaseOrderId: po1.id, productId: monitor.id, quantity: 100, unitPrice: 180.00, receivedQuantity: 100 },
      { purchaseOrderId: po2.id, productId: deskChair.id, quantity: 30, unitPrice: 280.00, receivedQuantity: 0 },
      { purchaseOrderId: po2.id, productId: desk.id, quantity: 20, unitPrice: 475.00, receivedQuantity: 0 },
      { purchaseOrderId: po3.id, productId: paper.id, quantity: 500, unitPrice: 4.50, receivedQuantity: 0 },
      { purchaseOrderId: po3.id, productId: pens.id, quantity: 100, unitPrice: 11.99, receivedQuantity: 0 },
    ],
  });

  // Create Stock Transfers
  console.log('🚚 Creating stock transfers...');
  await prisma.stockTransfer.createMany({
    data: [
      {
        productId: laptop.id,
        fromWarehouseId: warehouseMain.id,
        toWarehouseId: warehouseWest.id,
        quantity: 10,
        status: TransferStatus.COMPLETED,
        initiatedBy: managerUser.id,
        notes: 'Transfer to meet west coast demand',
      },
      {
        productId: keyboard.id,
        fromWarehouseId: warehouseMain.id,
        toWarehouseId: warehouseWest.id,
        quantity: 50,
        status: TransferStatus.IN_TRANSIT,
        initiatedBy: managerUser.id,
        notes: 'Balancing inventory across warehouses',
      },
    ],
  });

  // Create Activity Logs
  console.log('📜 Creating activity logs...');
  await prisma.activity.createMany({
    data: [
      {
        userId: adminUser.id,
        action: 'CREATE',
        entityType: 'Product',
        entityId: laptop.id,
        newValue: JSON.stringify({ sku: 'ELEC-LAP-001', name: 'Business Laptop 15"' }),
        details: 'Created new product',
      },
      {
        userId: managerUser.id,
        action: 'UPDATE',
        entityType: 'Stock',
        entityId: warehouseMain.id,
        oldValue: '40',
        newValue: '45',
        details: 'Stock adjustment for Business Laptop',
      },
      {
        userId: staffUser.id,
        action: 'CREATE',
        entityType: 'PurchaseOrder',
        entityId: po1.id,
        newValue: JSON.stringify({ poNumber: 'PO-2024-001' }),
        details: 'Created purchase order',
      },
    ],
  });

  console.log('✅ Database seeding completed successfully! 🎉');
  console.log('\n📊 Summary:');
  console.log(`   - Users: 3 (1 admin, 1 manager, 1 staff)`);
  console.log(`   - Warehouses: 3`);
  console.log(`   - Suppliers: 3`);
  console.log(`   - Products: 15`);
  console.log(`   - Stock Entries: 20`);
  console.log(`   - Purchase Orders: 3`);
  console.log(`   - Stock Transfers: 2`);
  console.log('\n🔐 Default login credentials:');
  console.log('   - admin@inventory.com / password123');
  console.log('   - manager@inventory.com / password123');
  console.log('   - staff@inventory.com / password123');
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
