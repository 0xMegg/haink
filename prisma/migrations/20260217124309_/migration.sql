-- DropForeignKey
ALTER TABLE "ExternalProductMap" DROP CONSTRAINT "ExternalProductMap_product_id_fkey";

-- DropForeignKey
ALTER TABLE "ProductCodeHistory" DROP CONSTRAINT "ProductCodeHistory_product_id_fkey";

-- DropForeignKey
ALTER TABLE "ProductImage" DROP CONSTRAINT "ProductImage_product_id_fkey";

-- DropForeignKey
ALTER TABLE "ProductOptionValue" DROP CONSTRAINT "ProductOptionValue_product_id_fkey";

-- AlterTable
ALTER TABLE "ExternalProductMap" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "last_synced_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updated_at" DROP DEFAULT,
ALTER COLUMN "updated_at" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Product" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updated_at" DROP DEFAULT,
ALTER COLUMN "updated_at" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "ProductCodeHistory" ALTER COLUMN "changed_at" SET DATA TYPE TIMESTAMP(3);

-- AddForeignKey
ALTER TABLE "ExternalProductMap" ADD CONSTRAINT "ExternalProductMap_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductImage" ADD CONSTRAINT "ProductImage_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductOptionValue" ADD CONSTRAINT "ProductOptionValue_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductCodeHistory" ADD CONSTRAINT "ProductCodeHistory_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "Product_current_category_idx" RENAME TO "Product_current_category_id_idx";

-- RenameIndex
ALTER INDEX "Product_issued_category_idx" RENAME TO "Product_issued_category_id_idx";

-- RenameIndex
ALTER INDEX "ProductOptionValue_unique_value" RENAME TO "ProductOptionValue_product_id_option_name_canonical_value_key";
