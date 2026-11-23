-- AlterTable
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "low_stock_threshold" INTEGER DEFAULT 5;
