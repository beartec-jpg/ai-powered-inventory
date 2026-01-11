# AI Command Parsing Test Examples

This document contains test commands to validate the two-stage AI parsing implementation.

## Test Commands

### Stock Management

#### ✅ ADD_STOCK
```
"Add 5 M10 nuts to rack 1 bin6"
Expected: { action: "ADD_STOCK", parameters: { item: "M10 nuts", quantity: 5, location: "rack 1 bin6" } }

"Received 20 bearings into warehouse"
Expected: { action: "ADD_STOCK", parameters: { item: "bearings", quantity: 20, location: "warehouse" } }

"Put 10 LMV37 into van"
Expected: { action: "ADD_STOCK", parameters: { item: "LMV37", quantity: 10, location: "van" } }
```

#### ✅ REMOVE_STOCK
```
"Used 2 filters from van"
Expected: { action: "REMOVE_STOCK", parameters: { item: "filters", quantity: 2, location: "van" } }

"Take 5 bearings from warehouse"
Expected: { action: "REMOVE_STOCK", parameters: { item: "bearings", quantity: 5, location: "warehouse" } }

"Remove 3 sensors from rack 5"
Expected: { action: "REMOVE_STOCK", parameters: { item: "sensors", quantity: 3, location: "rack 5" } }
```

#### ✅ TRANSFER_STOCK
```
"Move 10 bolts from warehouse to van"
Expected: { action: "TRANSFER_STOCK", parameters: { item: "bolts", quantity: 10, fromLocation: "warehouse", toLocation: "van" } }

"Transfer 5 filters from rack 1 to van 2"
Expected: { action: "TRANSFER_STOCK", parameters: { item: "filters", quantity: 5, fromLocation: "rack 1", toLocation: "van 2" } }
```

#### ✅ COUNT_STOCK
```
"I've got 50 bearings on shelf A"
Expected: { action: "COUNT_STOCK", parameters: { item: "bearings", quantity: 50, location: "shelf A" } }

"Count 25 filters in warehouse"
Expected: { action: "COUNT_STOCK", parameters: { item: "filters", quantity: 25, location: "warehouse" } }

"There are 100 bolts in bin 5"
Expected: { action: "COUNT_STOCK", parameters: { item: "bolts", quantity: 100, location: "bin 5" } }
```

#### ✅ SEARCH_STOCK
```
"What bearings do we have?"
Expected: { action: "SEARCH_STOCK", parameters: { search: "bearings" } }

"Search stock for filters"
Expected: { action: "SEARCH_STOCK", parameters: { search: "filters" } }

"Show me bolts in warehouse"
Expected: { action: "SEARCH_STOCK", parameters: { search: "bolts", location: "warehouse" } }
```

#### ✅ LOW_STOCK_REPORT
```
"Show low stock items"
Expected: { action: "LOW_STOCK_REPORT", parameters: {} }

"Low stock report for warehouse"
Expected: { action: "LOW_STOCK_REPORT", parameters: { location: "warehouse" } }
```

### Catalogue Management

#### ✅ ADD_PRODUCT
```
"Add new item cable 0.75mm cost 25 markup 35%"
Expected: { action: "ADD_PRODUCT", parameters: { name: "cable 0.75mm", unitCost: 25, markup: 35 } }

"Create product LMV37 cost 450 markup 40%"
Expected: { action: "ADD_PRODUCT", parameters: { name: "LMV37", unitCost: 450, markup: 40 } }

"New part Siemens burner controller cost 500"
Expected: { action: "ADD_PRODUCT", parameters: { name: "Siemens burner controller", unitCost: 500 } }
```

#### ✅ UPDATE_PRODUCT
```
"Update LMV37 cost to 500"
Expected: { action: "UPDATE_PRODUCT", parameters: { partNumber: "LMV37", unitCost: 500 } }
```

#### ✅ SEARCH_CATALOGUE
```
"Find cables"
Expected: { action: "SEARCH_CATALOGUE", parameters: { search: "cables" } }

"Search catalogue for Siemens products"
Expected: { action: "SEARCH_CATALOGUE", parameters: { search: "Siemens" } }
```

### Customer Management

#### ✅ ADD_CUSTOMER
```
"New customer ABC Heating"
Expected: { action: "ADD_CUSTOMER", parameters: { name: "ABC Heating" } }

"Add customer XYZ Industries"
Expected: { action: "ADD_CUSTOMER", parameters: { name: "XYZ Industries" } }

"Create customer Smith & Co type commercial"
Expected: { action: "ADD_CUSTOMER", parameters: { name: "Smith & Co", type: "commercial" } }
```

#### ✅ ADD_SITE
```
"Add site Office for ABC Heating at 123 High St"
Expected: { action: "ADD_SITE", parameters: { customerName: "ABC Heating", siteName: "Office", address: "123 High St" } }
```

### Job Management

#### ✅ CREATE_JOB
```
"New job for ABC Heating - boiler repair"
Expected: { action: "CREATE_JOB", parameters: { customerName: "ABC Heating", description: "boiler repair", type: "repair" } }

"Create service job for XYZ Ltd"
Expected: { action: "CREATE_JOB", parameters: { customerName: "XYZ Ltd", type: "service" } }
```

#### ✅ COMPLETE_JOB
```
"Complete job 1234"
Expected: { action: "COMPLETE_JOB", parameters: { jobNumber: "1234" } }
```

#### ✅ ADD_PARTS_TO_JOB
```
"Add 2 filters to job 1234"
Expected: { action: "ADD_PARTS_TO_JOB", parameters: { jobNumber: "1234", partNumber: "filters", quantity: 2 } }
```

#### ✅ SEARCH_JOBS
```
"Show jobs for ABC Heating"
Expected: { action: "SEARCH_JOBS", parameters: { customerName: "ABC Heating" } }

"List completed jobs"
Expected: { action: "SEARCH_JOBS", parameters: { status: "completed" } }
```

### Equipment Management

#### ✅ ADD_EQUIPMENT
```
"Add boiler Main Boiler for ABC Heating"
Expected: { action: "ADD_EQUIPMENT", parameters: { customerName: "ABC Heating", equipmentName: "Main Boiler", type: "boiler" } }
```

#### ✅ INSTALL_PART
```
"Install filter on Main Boiler for ABC Heating"
Expected: { action: "INSTALL_PART", parameters: { partNumber: "filter", customerName: "ABC Heating", equipmentName: "Main Boiler" } }
```

### Supplier Management

#### ✅ ADD_SUPPLIER
```
"New supplier Acme Corp"
Expected: { action: "ADD_SUPPLIER", parameters: { name: "Acme Corp" } }
```

#### ✅ CREATE_ORDER
```
"Create order from Acme Corp"
Expected: { action: "CREATE_ORDER", parameters: { supplierName: "Acme Corp" } }
```

## Contextual Commands

These require previous commands to establish context:

```
# Initial command
"Add 5 M10 nuts to rack 1 bin6"

# Follow-up commands that use context
"Add 5 more"
→ Should resolve to: { item: "M10 nuts", quantity: 5, location: "rack 1 bin6" }

"Same thing to van"
→ Should resolve to: { item: "M10 nuts", location: "van" }

"Transfer them to warehouse"
→ Should resolve to: { item: "M10 nuts", toLocation: "warehouse" }
```

## Edge Cases

```
"Add 5 M10 nuts"
→ Missing location, should ask for clarification

"Add M10 nuts to rack 1"
→ Missing quantity, should ask for clarification

"What do we have?"
→ Should default to SEARCH_STOCK with empty search or QUERY_INVENTORY

"Move bolts"
→ Missing quantity and locations, should ask for clarification
```

## AI Failure Scenarios

When AI service is unavailable, these should still work via fallback parser:

```
"Add 5 bolts to warehouse" → ADD_STOCK
"Used 2 filters from van" → REMOVE_STOCK
"Move 10 nuts from warehouse to van" → TRANSFER_STOCK
"I've got 50 bearings on rack 1" → COUNT_STOCK
"New customer ABC Ltd" → ADD_CUSTOMER
"New job for ABC" → CREATE_JOB
```

## Known Limitations

1. **Complex items**: Multi-word items with special characters may need better extraction
2. **Multiple actions**: "Add 5 nuts and remove 2 filters" - currently handles one action
3. **Ambiguous locations**: "the shelf" vs "shelf A" - needs context
4. **Quantity inference**: "Add nuts to warehouse" - could ask or default to 1

## Success Criteria

✅ Command classified correctly (action matches expected)
✅ Parameters extracted accurately
✅ Confidence score > 0.8 for clear commands
✅ Fallback works when AI unavailable
✅ Context resolution works for "add more" patterns
✅ Missing required params identified
