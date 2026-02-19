-- AlterTable
ALTER TABLE "ProductImage" ADD COLUMN "storage_key" TEXT;

UPDATE "ProductImage"
SET "storage_key" = COALESCE("url", '');

ALTER TABLE "ProductImage" ALTER COLUMN "storage_key" SET NOT NULL;

ALTER TABLE "ProductImage" DROP COLUMN "url";
