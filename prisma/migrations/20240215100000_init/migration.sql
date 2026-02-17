-- Create Enums
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TYPE "ExternalSystem" AS ENUM ('IMWEB', 'ECOUNT');
CREATE TYPE "SyncDirection" AS ENUM ('PULL', 'PUSH');
CREATE TYPE "SOTMode" AS ENUM ('LEGACY_IMWEB', 'MASTER');
CREATE TYPE "SourceOfTruth" AS ENUM ('IMWEB', 'MASTER');

-- Product table
CREATE TABLE "Product" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  "master_code" TEXT NOT NULL UNIQUE,
  "name" TEXT NOT NULL,
  "issued_category_id" TEXT NOT NULL,
  "current_category_id" TEXT NOT NULL,
  "category_ids_raw" JSONB NOT NULL,
  "price_sale" INTEGER NOT NULL,
  "inventory_track" BOOLEAN NOT NULL,
  "stock_qty" INTEGER,
  "sale_status" TEXT,
  "display_status" BOOLEAN NOT NULL,
  "description_html" TEXT,
  "option_name" TEXT,
  "sot_mode" "SOTMode" NOT NULL DEFAULT 'LEGACY_IMWEB',
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX "Product_issued_category_idx" ON "Product" ("issued_category_id");
CREATE INDEX "Product_current_category_idx" ON "Product" ("current_category_id");

-- Code sequence
CREATE TABLE "CodeSequenceByCategory" (
  "issued_category_id" TEXT PRIMARY KEY,
  "next_seq" INTEGER NOT NULL DEFAULT 1
);

-- External product map
CREATE TABLE "ExternalProductMap" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  "product_id" TEXT NOT NULL REFERENCES "Product"("id") ON DELETE CASCADE,
  "system" "ExternalSystem" NOT NULL,
  "external_id" TEXT NOT NULL,
  "external_url" TEXT,
  "source_of_truth" "SourceOfTruth",
  "last_sync_direction" "SyncDirection",
  "last_synced_at" TIMESTAMPTZ,
  "raw_snapshot" JSONB,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX "ExternalProductMap_system_external_id_key" ON "ExternalProductMap" ("system", "external_id");
CREATE INDEX "ExternalProductMap_product_id_idx" ON "ExternalProductMap" ("product_id");

-- Product image
CREATE TABLE "ProductImage" (
  "id" SERIAL PRIMARY KEY,
  "product_id" TEXT NOT NULL REFERENCES "Product"("id") ON DELETE CASCADE,
  "type" TEXT NOT NULL,
  "url" TEXT NOT NULL,
  "sort_order" INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX "ProductImage_product_id_idx" ON "ProductImage" ("product_id");

-- Product option value
CREATE TABLE "ProductOptionValue" (
  "id" SERIAL PRIMARY KEY,
  "product_id" TEXT NOT NULL REFERENCES "Product"("id") ON DELETE CASCADE,
  "option_name" TEXT NOT NULL,
  "display_value" TEXT NOT NULL,
  "canonical_value" TEXT NOT NULL
);

CREATE UNIQUE INDEX "ProductOptionValue_unique_value" ON "ProductOptionValue" ("product_id", "option_name", "canonical_value");
CREATE INDEX "ProductOptionValue_product_id_idx" ON "ProductOptionValue" ("product_id");

-- Product code history
CREATE TABLE "ProductCodeHistory" (
  "id" SERIAL PRIMARY KEY,
  "product_id" TEXT NOT NULL REFERENCES "Product"("id") ON DELETE CASCADE,
  "old_master_code" TEXT NOT NULL,
  "new_master_code" TEXT NOT NULL,
  "changed_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "reason" TEXT
);

CREATE INDEX "ProductCodeHistory_product_id_idx" ON "ProductCodeHistory" ("product_id");

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW."updated_at" = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER product_set_updated_at
BEFORE UPDATE ON "Product"
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER external_product_map_set_updated_at
BEFORE UPDATE ON "ExternalProductMap"
FOR EACH ROW EXECUTE FUNCTION set_updated_at();
