-- AlterTable
ALTER TABLE "subscriptions" ADD COLUMN IF NOT EXISTS "billing_credit_balance" DECIMAL(10,2) NOT NULL DEFAULT 0;
