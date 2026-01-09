# Field Service & Inventory Management System

This document describes the comprehensive overhaul that transforms the basic inventory tracker into a professional-grade Field Service & Inventory Management System.

## Overview

The system is now a **dual-purpose platform** that distinguishes between:
- **Catalogue**: All products you sell/use (whether in stock or not)
- **Stock**: Physical inventory at specific locations

## Key Features

### 1. Catalogue Management
Products you sell/use, whether you stock them or not:
- Part numbers, descriptions, manufacturers
- Flexible attributes (size, color, voltage, etc.)
- Pricing with cost, markup, and sell price
- Supplier information
- Stock settings (is it normally stocked, min quantity, reorder point)

**Example Commands:**
- "Add new item cable 0.75mm trirated 100m roll black cost 25 markup 35%"
- "Update LMV4 pricing to cost 45 markup 40%"
- "Find 0.75 cables"

### 2. Stock Management
Physical inventory at specific locations:
- Receive stock from deliveries
- Put away stock to specific bins/racks
- Use stock for jobs/installations
- Transfer between locations
- Stock counting with discrepancy tracking
- Low stock reports

**Example Commands:**
- "Received 10 LMV37 from Comtherm into warehouse"
- "I've got 5 LMV37 on rack12 bin 2" (stock count)
- "Move 3 sensors from warehouse to Van 1"
- "What's running low?"

### 3. Customer & Equipment Management
Track customer assets you service:
- Customer profiles with multiple site addresses
- Equipment at customer sites (boilers, chillers, pumps, etc.)
- Service intervals and contract types
- Equipment history and technical notes

**Example Commands:**
- "Create customer ABC Manufacturing type commercial"
- "Add site Main Factory at ABC Manufacturing"
- "Create equipment main boiler at ABC Manufacturing"
- "List equipment for ABC Manufacturing"

### 4. Parts Installation Tracking
Record what parts are installed where:
- Install from stock (decrements inventory)
- Install direct order (from supplier, no stock change)
- Track what's on each piece of equipment
- Installation history with dates and job references

**Example Commands:**
- "Install LMV4 from van stock on ABC Manufacturing's main boiler"
- "Add Siemens LMV4 56779 from Comtherm to customer ABC's boiler" (direct order)
- "What parts are on ABC's main boiler?"

### 5. Job Management
Complete work order lifecycle:
- Job types: service, repair, installation, maintenance, quote, inspection
- Job status tracking (quote → scheduled → in progress → completed → invoiced)
- Parts used on jobs
- Labour hours and costs
- Customer signatures

**Example Commands:**
- "Create job for ABC Manufacturing boiler service"
- "Schedule job JOB-1234 for tomorrow"
- "Start job JOB-1234"
- "Complete job JOB-1234 with work description"
- "Add part LMV4 to job JOB-1234"

### 6. Supplier & Purchase Orders
Manage suppliers and ordering:
- Supplier profiles with contact details
- Create purchase orders
- Track PO status
- Receive deliveries

**Example Commands:**
- "Create supplier Comtherm Limited"
- "Create purchase order for Comtherm with 10x LMV4 at 45 each"
- "Mark PO-12345 as received"

## Data Model

### Core Entities

1. **CatalogueItem** - Products you sell/use
2. **StockLevel** - Physical inventory at locations
3. **Customer** - With multiple SiteAddresses
4. **Equipment** - Customer assets to service
5. **InstalledPart** - Parts on equipment
6. **Job** - Work orders with UsedParts
7. **Supplier** - Supplier information
8. **PurchaseOrder** - With POItems

## AI Command Recognition

The system uses xAI Grok to parse natural language commands with 36 different tool functions:

### Catalogue Management (3 tools)
- `create_catalogue_item` - Add products to catalogue
- `update_catalogue_item` - Update pricing, details
- `search_catalogue` - Find products (stocked or not)

### Stock Management (8 tools)
- `receive_stock` - Add stock from delivery
- `put_away_stock` - Set/change location
- `use_stock` - Decrease stock
- `transfer_stock` - Move between locations
- `stock_count` - Verify/update quantity
- `search_stock` - Find only in-stock items
- `low_stock_report` - Items below minimum
- `set_min_stock` - Update reorder point

### Customer & Equipment (5 tools)
- `create_customer` - New customer
- `add_site_address` - Add site to customer
- `create_equipment` - Add equipment
- `update_equipment` - Update details
- `list_equipment` - Show customer's equipment

### Parts Installation (4 tools)
- `install_from_stock` - Install and decrement stock
- `install_direct_order` - Record direct order (no stock change)
- `query_equipment_parts` - What's on equipment
- `query_customer_parts` - All parts for customer

### Jobs (6 tools)
- `create_job` - New work order
- `schedule_job` - Set date/time
- `start_job` - Mark in progress
- `complete_job` - Mark done
- `add_part_to_job` - Log part usage
- `list_jobs` - Show jobs (filtered)

### Suppliers & Orders (3 tools)
- `create_supplier` - New supplier
- `create_purchase_order` - Order parts
- `receive_purchase_order` - Mark received

### Legacy Actions (7 tools)
Backward compatible with original system

## Technical Implementation

### Files Modified

1. **src/lib/types.ts** - 13 new comprehensive interfaces
2. **api/ai/parse-command.ts** - 36 AI tool definitions, updated system prompt
3. **src/lib/command-executor.ts** - Complete rewrite with 36 action handlers (1200+ lines)
4. **src/pages/Dashboard.tsx** - 5-tab layout, new state management
5. **src/components/JobsView.tsx** - Updated for new Job type
6. **src/components/EquipmentView.tsx** - New component
7. **src/components/SuppliersView.tsx** - New component

### State Management

Uses `@github/spark/hooks` `useKV` for persistence:
- `catalogue` - CatalogueItem[]
- `stock-levels` - StockLevel[]
- `customers` - Customer[]
- `equipment` - Equipment[]
- `installed-parts` - InstalledPart[]
- `jobs` - Job[]
- `suppliers` - Supplier[]
- `purchase-orders` - PurchaseOrder[]

Plus legacy state for backward compatibility:
- `inventory` - InventoryItem[]
- `locations` - Location[]
- `command-logs` - CommandLog[]

## UI Updates

### Dashboard Tabs

1. **Inventory** - Stock levels with locations
2. **Equipment** - Customer equipment cards
3. **Suppliers** - Supplier profiles
4. **Jobs** - Work orders with status
5. **History** - Command execution log

### Title Change
"AI Stock Manager" → "Field Service Manager"

## Testing

### Setup
1. Configure Clerk authentication (see .env.example)
2. Set XAI_API_KEY for Grok integration
3. Run `npm install && npm run dev`

### Example Test Scenarios

#### Scenario 1: Stock Receipt Flow
```
1. "Create supplier Comtherm Limited"
2. "Add new item LMV4 valve cost 45 markup 40%"
3. "Received 10 LMV4 from Comtherm into warehouse"
4. "I've got 10 LMV4 on rack 12" (stock count - verify)
```

#### Scenario 2: Customer Equipment Setup
```
1. "Create customer ABC Manufacturing type commercial"
2. "Create equipment main boiler at ABC Manufacturing"
3. "Install LMV4 from warehouse on ABC's main boiler"
4. "What parts are on ABC's main boiler?"
```

#### Scenario 3: Job Workflow
```
1. "Create job for ABC Manufacturing boiler service"
2. "Add part LMV4 quantity 1 to job JOB-xxx-xxxx"
3. "Complete job JOB-xxx-xxxx with annual service completed"
```

#### Scenario 4: Stock Management
```
1. "Search for LMV in stock"
2. "Set minimum stock for LMV4 to 5"
3. "What's running low?"
4. "Transfer 2 LMV4 from warehouse to Van 1"
```

## Backward Compatibility

All legacy actions are maintained:
- `add_item`
- `remove_item`
- `move_item`
- `update_quantity`
- `create_location`
- `stock_check`
- `query`
- `list_items`

Existing inventory data continues to work.

## Future Enhancements

Potential additions (not implemented):
- ClarificationDialog component for missing information
- Advanced search with filters
- Reports and analytics
- Mobile app for field engineers
- QR code scanning for equipment
- Calendar integration for scheduling
- Invoice generation
- Photo attachments for jobs/equipment

## Build & Deploy

```bash
# Development
npm run dev

# Production build
npm run build

# Build output: dist/
```

Build tested and succeeds ✅
