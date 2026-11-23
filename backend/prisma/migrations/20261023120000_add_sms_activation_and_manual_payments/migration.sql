-- AlterEnum
ALTER TYPE "SmsCreditTransactionType" ADD VALUE IF NOT EXISTS 'INITIAL_BONUS';

-- CreateEnum
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'SmsPaymentMethod') THEN
        CREATE TYPE "SmsPaymentMethod" AS ENUM ('BANK_TRANSFER', 'CASH', 'CHEQUE', 'OTHER');
    END IF;
END $$;

-- AlterTable
ALTER TABLE "tenant_sms_wallets" ADD COLUMN IF NOT EXISTS "is_active" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "tenant_sms_wallets" ADD COLUMN IF NOT EXISTS "activated_at" TIMESTAMP(3);
ALTER TABLE "tenant_sms_wallets" ADD COLUMN IF NOT EXISTS "initial_bonus_granted" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "tenant_sms_wallets" ADD COLUMN IF NOT EXISTS "initial_bonus_granted_at" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "tenant_sms_wallets_is_active_idx" ON "tenant_sms_wallets"("is_active");

-- Preserve existing active wallets with credits so they aren't unexpectedly disabled
UPDATE "tenant_sms_wallets"
SET "is_active" = true,
    "activated_at" = COALESCE("activated_at", CURRENT_TIMESTAMP)
WHERE ("balance" > 0 OR "total_purchased" > 0) AND "is_active" = false;

-- CreateTable
CREATE TABLE IF NOT EXISTS "sms_manual_payments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "credits" INTEGER NOT NULL,
    "payment_method" "SmsPaymentMethod" NOT NULL DEFAULT 'BANK_TRANSFER',
    "payment_reference" TEXT NOT NULL,
    "payment_date" TIMESTAMP(3) NOT NULL,
    "confirmed_by_admin_id" UUID NOT NULL,
    "notes" TEXT,
    "credit_transaction_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sms_manual_payments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "sms_manual_payments_credit_transaction_id_key" ON "sms_manual_payments"("credit_transaction_id");
CREATE INDEX IF NOT EXISTS "sms_manual_payments_tenant_id_idx" ON "sms_manual_payments"("tenant_id");
CREATE INDEX IF NOT EXISTS "sms_manual_payments_confirmed_by_admin_id_idx" ON "sms_manual_payments"("confirmed_by_admin_id");
CREATE INDEX IF NOT EXISTS "sms_manual_payments_payment_reference_idx" ON "sms_manual_payments"("payment_reference");
CREATE INDEX IF NOT EXISTS "sms_manual_payments_created_at_idx" ON "sms_manual_payments"("created_at");

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sms_manual_payments_tenant_id_fkey') THEN
        ALTER TABLE "sms_manual_payments" ADD CONSTRAINT "sms_manual_payments_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sms_manual_payments_confirmed_by_admin_id_fkey') THEN
        ALTER TABLE "sms_manual_payments" ADD CONSTRAINT "sms_manual_payments_confirmed_by_admin_id_fkey" FOREIGN KEY ("confirmed_by_admin_id") REFERENCES "super_admin_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sms_manual_payments_credit_transaction_id_fkey') THEN
        ALTER TABLE "sms_manual_payments" ADD CONSTRAINT "sms_manual_payments_credit_transaction_id_fkey" FOREIGN KEY ("credit_transaction_id") REFERENCES "sms_credit_transactions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;
