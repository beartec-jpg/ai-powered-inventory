CREATE TYPE "public"."po_status" AS ENUM('DRAFT', 'SUBMITTED', 'CONFIRMED', 'RECEIVED', 'COMPLETED', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "public"."stock_movement_type" AS ENUM('INBOUND', 'OUTBOUND', 'ADJUSTMENT', 'RETURN', 'TRANSFER', 'DAMAGE', 'LOSS');--> statement-breakpoint
CREATE TYPE "public"."transfer_status" AS ENUM('PENDING', 'IN_TRANSIT', 'COMPLETED', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('ADMIN', 'MANAGER', 'STAFF', 'VIEWER');--> statement-breakpoint
CREATE TABLE "activities" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"action" varchar(255) NOT NULL,
	"entity_type" varchar(100) NOT NULL,
	"entity_id" text NOT NULL,
	"old_value" text,
	"new_value" text,
	"details" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "catalogue_items" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"part_number" varchar(100) NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"manufacturer" varchar(255),
	"category" varchar(100),
	"subcategory" varchar(100),
	"unit_cost" real,
	"markup" real,
	"sell_price" real,
	"is_stocked" boolean DEFAULT false NOT NULL,
	"min_quantity" integer,
	"preferred_supplier_name" varchar(255),
	"attributes" text,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chat_conversations" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"title" varchar(255),
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chat_messages" (
	"id" text PRIMARY KEY NOT NULL,
	"conversation_id" text NOT NULL,
	"role" varchar(50) NOT NULL,
	"content" text NOT NULL,
	"tool_calls" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "customers" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"name" varchar(255) NOT NULL,
	"type" varchar(50) NOT NULL,
	"contact_name" varchar(255),
	"email" varchar(255),
	"phone" varchar(50),
	"mobile" varchar(50),
	"billing_address" text,
	"account_number" varchar(100),
	"vat_number" varchar(100),
	"payment_terms" varchar(255),
	"notes" text,
	"tags" text,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "equipment" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"customer_id" text NOT NULL,
	"customer_name" varchar(255) NOT NULL,
	"site_address_id" text,
	"name" varchar(255) NOT NULL,
	"type" varchar(100) NOT NULL,
	"manufacturer" varchar(255),
	"model" varchar(255),
	"serial_number" varchar(255),
	"location" varchar(255),
	"access_notes" text,
	"install_date" timestamp,
	"warranty_expiry" timestamp,
	"service_interval" integer,
	"last_service_date" timestamp,
	"next_service_due" timestamp,
	"contract_type" varchar(50),
	"contract_expiry" timestamp,
	"technical_notes" text,
	"qr_code" varchar(255),
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "jobs" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"job_number" varchar(100) NOT NULL,
	"customer_id" text NOT NULL,
	"customer_name" varchar(255) NOT NULL,
	"site_address_id" text,
	"site_address" text,
	"equipment_id" text,
	"equipment_name" varchar(255),
	"type" varchar(50) NOT NULL,
	"priority" varchar(50) DEFAULT 'normal' NOT NULL,
	"description" text,
	"reported_fault" text,
	"work_required" text,
	"assigned_to" text,
	"assigned_engineer_name" varchar(255),
	"status" varchar(50) DEFAULT 'quote' NOT NULL,
	"scheduled_date" timestamp,
	"scheduled_time_slot" varchar(100),
	"estimated_duration" integer,
	"started_at" timestamp,
	"completed_at" timestamp,
	"completed_by" varchar(255),
	"work_carried_out" text,
	"findings" text,
	"recommendations" text,
	"parts_used" text,
	"labour_hours" real,
	"labour_rate" real,
	"parts_cost" real,
	"total_cost" real,
	"customer_signature" text,
	"signed_by_name" varchar(255),
	"signed_at" timestamp,
	"follow_up_required" boolean DEFAULT false,
	"follow_up_notes" text,
	"notes" text,
	"internal_notes" text,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_suppliers" (
	"id" text PRIMARY KEY NOT NULL,
	"product_id" text NOT NULL,
	"supplier_id" text NOT NULL,
	"supplier_sku" varchar(100),
	"lead_time" integer,
	"min_order" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" text PRIMARY KEY NOT NULL,
	"sku" varchar(100) NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"category" varchar(100) NOT NULL,
	"unit_price" real NOT NULL,
	"unit" varchar(50) DEFAULT 'pcs' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "products_sku_unique" UNIQUE("sku")
);
--> statement-breakpoint
CREATE TABLE "purchase_order_items" (
	"id" text PRIMARY KEY NOT NULL,
	"purchase_order_id" text NOT NULL,
	"product_id" text NOT NULL,
	"quantity" integer NOT NULL,
	"unit_price" real NOT NULL,
	"received_quantity" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "purchase_orders" (
	"id" text PRIMARY KEY NOT NULL,
	"po_number" varchar(100) NOT NULL,
	"supplier_id" text NOT NULL,
	"status" "po_status" DEFAULT 'DRAFT' NOT NULL,
	"expected_date" timestamp,
	"received_date" timestamp,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "purchase_orders_po_number_unique" UNIQUE("po_number")
);
--> statement-breakpoint
CREATE TABLE "stock_levels" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"catalogue_item_id" text NOT NULL,
	"part_number" varchar(100) NOT NULL,
	"name" varchar(255) NOT NULL,
	"location" varchar(255) NOT NULL,
	"quantity" integer DEFAULT 0 NOT NULL,
	"last_movement_at" timestamp,
	"last_counted_at" timestamp,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stock_movements" (
	"id" text PRIMARY KEY NOT NULL,
	"product_id" text NOT NULL,
	"quantity" integer NOT NULL,
	"movement_type" "stock_movement_type" NOT NULL,
	"reference" varchar(255),
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stock_transfers" (
	"id" text PRIMARY KEY NOT NULL,
	"from_warehouse_id" text NOT NULL,
	"to_warehouse_id" text NOT NULL,
	"quantity" integer NOT NULL,
	"status" "transfer_status" DEFAULT 'PENDING' NOT NULL,
	"initiated_by" text NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stocks" (
	"id" text PRIMARY KEY NOT NULL,
	"product_id" text NOT NULL,
	"warehouse_id" text NOT NULL,
	"quantity" integer DEFAULT 0 NOT NULL,
	"reserved" integer DEFAULT 0 NOT NULL,
	"available" integer DEFAULT 0 NOT NULL,
	"reorder_level" integer DEFAULT 10 NOT NULL,
	"last_counted" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "suppliers" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"name" varchar(255) NOT NULL,
	"email" varchar(255),
	"phone" varchar(50),
	"address" text,
	"city" varchar(100),
	"country" varchar(100),
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tool_calls" (
	"id" text PRIMARY KEY NOT NULL,
	"message_id" text NOT NULL,
	"tool_name" varchar(100) NOT NULL,
	"arguments" text NOT NULL,
	"result" text,
	"status" varchar(50) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_profiles" (
	"id" text PRIMARY KEY NOT NULL,
	"clerk_user_id" varchar(255) NOT NULL,
	"email" varchar(255) NOT NULL,
	"full_name" varchar(255),
	"phone" varchar(50),
	"role" "user_role" DEFAULT 'VIEWER' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_profiles_clerk_user_id_unique" UNIQUE("clerk_user_id")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"email" varchar(255) NOT NULL,
	"password" text NOT NULL,
	"name" varchar(255) NOT NULL,
	"role" "user_role" DEFAULT 'STAFF' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "warehouse_accesses" (
	"id" text PRIMARY KEY NOT NULL,
	"user_profile_id" text NOT NULL,
	"warehouse_id" text NOT NULL,
	"access_level" varchar(100) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "warehouses" (
	"id" text PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"location" text NOT NULL,
	"capacity" integer NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "warehouses_name_unique" UNIQUE("name")
);
--> statement-breakpoint
ALTER TABLE "activities" ADD CONSTRAINT "activities_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "catalogue_items" ADD CONSTRAINT "catalogue_items_user_id_user_profiles_clerk_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user_profiles"("clerk_user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_conversations" ADD CONSTRAINT "chat_conversations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_conversation_id_chat_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."chat_conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customers" ADD CONSTRAINT "customers_user_id_user_profiles_clerk_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user_profiles"("clerk_user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "equipment" ADD CONSTRAINT "equipment_user_id_user_profiles_clerk_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user_profiles"("clerk_user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "equipment" ADD CONSTRAINT "equipment_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_user_id_user_profiles_clerk_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user_profiles"("clerk_user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_equipment_id_equipment_id_fk" FOREIGN KEY ("equipment_id") REFERENCES "public"."equipment"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_suppliers" ADD CONSTRAINT "product_suppliers_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_suppliers" ADD CONSTRAINT "product_suppliers_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_order_items" ADD CONSTRAINT "purchase_order_items_purchase_order_id_purchase_orders_id_fk" FOREIGN KEY ("purchase_order_id") REFERENCES "public"."purchase_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_levels" ADD CONSTRAINT "stock_levels_user_id_user_profiles_clerk_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user_profiles"("clerk_user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_levels" ADD CONSTRAINT "stock_levels_catalogue_item_id_catalogue_items_id_fk" FOREIGN KEY ("catalogue_item_id") REFERENCES "public"."catalogue_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_transfers" ADD CONSTRAINT "stock_transfers_from_warehouse_id_warehouses_id_fk" FOREIGN KEY ("from_warehouse_id") REFERENCES "public"."warehouses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_transfers" ADD CONSTRAINT "stock_transfers_to_warehouse_id_warehouses_id_fk" FOREIGN KEY ("to_warehouse_id") REFERENCES "public"."warehouses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_transfers" ADD CONSTRAINT "stock_transfers_initiated_by_users_id_fk" FOREIGN KEY ("initiated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stocks" ADD CONSTRAINT "stocks_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stocks" ADD CONSTRAINT "stocks_warehouse_id_warehouses_id_fk" FOREIGN KEY ("warehouse_id") REFERENCES "public"."warehouses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "suppliers" ADD CONSTRAINT "suppliers_user_id_user_profiles_clerk_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user_profiles"("clerk_user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tool_calls" ADD CONSTRAINT "tool_calls_message_id_chat_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."chat_messages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "warehouse_accesses" ADD CONSTRAINT "warehouse_accesses_user_profile_id_user_profiles_id_fk" FOREIGN KEY ("user_profile_id") REFERENCES "public"."user_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "warehouse_accesses" ADD CONSTRAINT "warehouse_accesses_warehouse_id_warehouses_id_fk" FOREIGN KEY ("warehouse_id") REFERENCES "public"."warehouses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "activities_user_idx" ON "activities" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "activities_entity_type_idx" ON "activities" USING btree ("entity_type");--> statement-breakpoint
CREATE INDEX "activities_created_at_idx" ON "activities" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "catalogue_items_user_part_number_idx" ON "catalogue_items" USING btree ("user_id","part_number");--> statement-breakpoint
CREATE INDEX "catalogue_items_category_idx" ON "catalogue_items" USING btree ("category");--> statement-breakpoint
CREATE INDEX "catalogue_items_manufacturer_idx" ON "catalogue_items" USING btree ("manufacturer");--> statement-breakpoint
CREATE INDEX "catalogue_items_user_id_idx" ON "catalogue_items" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "chat_conversations_user_idx" ON "chat_conversations" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "chat_messages_conversation_idx" ON "chat_messages" USING btree ("conversation_id");--> statement-breakpoint
CREATE INDEX "chat_messages_created_at_idx" ON "chat_messages" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "customers_user_id_idx" ON "customers" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "customers_name_idx" ON "customers" USING btree ("name");--> statement-breakpoint
CREATE INDEX "equipment_user_id_idx" ON "equipment" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "equipment_customer_id_idx" ON "equipment" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "equipment_type_idx" ON "equipment" USING btree ("type");--> statement-breakpoint
CREATE INDEX "jobs_user_id_idx" ON "jobs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "jobs_customer_id_idx" ON "jobs" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "jobs_equipment_id_idx" ON "jobs" USING btree ("equipment_id");--> statement-breakpoint
CREATE INDEX "jobs_status_idx" ON "jobs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "jobs_job_number_idx" ON "jobs" USING btree ("job_number");--> statement-breakpoint
CREATE UNIQUE INDEX "jobs_user_job_number_idx" ON "jobs" USING btree ("user_id","job_number");--> statement-breakpoint
CREATE UNIQUE INDEX "product_suppliers_product_supplier_idx" ON "product_suppliers" USING btree ("product_id","supplier_id");--> statement-breakpoint
CREATE UNIQUE INDEX "products_sku_idx" ON "products" USING btree ("sku");--> statement-breakpoint
CREATE INDEX "products_category_idx" ON "products" USING btree ("category");--> statement-breakpoint
CREATE UNIQUE INDEX "purchase_orders_po_number_idx" ON "purchase_orders" USING btree ("po_number");--> statement-breakpoint
CREATE INDEX "purchase_orders_supplier_idx" ON "purchase_orders" USING btree ("supplier_id");--> statement-breakpoint
CREATE UNIQUE INDEX "stock_levels_user_catalogue_item_location_idx" ON "stock_levels" USING btree ("user_id","catalogue_item_id","location");--> statement-breakpoint
CREATE INDEX "stock_levels_location_idx" ON "stock_levels" USING btree ("location");--> statement-breakpoint
CREATE INDEX "stock_levels_part_number_idx" ON "stock_levels" USING btree ("part_number");--> statement-breakpoint
CREATE INDEX "stock_levels_user_id_idx" ON "stock_levels" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "stock_movements_product_idx" ON "stock_movements" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "stock_movements_created_at_idx" ON "stock_movements" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "stock_transfers_from_warehouse_idx" ON "stock_transfers" USING btree ("from_warehouse_id");--> statement-breakpoint
CREATE INDEX "stock_transfers_to_warehouse_idx" ON "stock_transfers" USING btree ("to_warehouse_id");--> statement-breakpoint
CREATE UNIQUE INDEX "stocks_product_warehouse_idx" ON "stocks" USING btree ("product_id","warehouse_id");--> statement-breakpoint
CREATE INDEX "stocks_warehouse_idx" ON "stocks" USING btree ("warehouse_id");--> statement-breakpoint
CREATE UNIQUE INDEX "suppliers_user_name_idx" ON "suppliers" USING btree ("user_id","name");--> statement-breakpoint
CREATE INDEX "suppliers_user_id_idx" ON "suppliers" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "tool_calls_message_idx" ON "tool_calls" USING btree ("message_id");--> statement-breakpoint
CREATE UNIQUE INDEX "user_profiles_clerk_user_id_idx" ON "user_profiles" USING btree ("clerk_user_id");--> statement-breakpoint
CREATE INDEX "user_profiles_email_idx" ON "user_profiles" USING btree ("email");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_idx" ON "users" USING btree ("email");--> statement-breakpoint
CREATE UNIQUE INDEX "warehouse_accesses_user_warehouse_idx" ON "warehouse_accesses" USING btree ("user_profile_id","warehouse_id");--> statement-breakpoint
CREATE UNIQUE INDEX "warehouses_name_idx" ON "warehouses" USING btree ("name");