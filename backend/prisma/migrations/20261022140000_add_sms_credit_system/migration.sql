-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'LOW_SMS_BALANCE';

-- CreateEnum
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'SmsCreditTransactionType') THEN
        CREATE TYPE "SmsCreditTransactionType" AS ENUM ('PURCHASE', 'USAGE', 'REFUND', 'ADJUSTMENT');
    END IF;
END $$;

-- CreateEnum
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'SmsDeliveryStatus') THEN
        CREATE TYPE "SmsDeliveryStatus" AS ENUM ('PENDING', 'SUBMITTED', 'DELIVERED', 'FAILED');
    END IF;
END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "sms_packages" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "credits" INTEGER NOT NULL,
    "price" DECIMAL(10,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'LKR',
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sms_packages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "tenant_sms_wallets" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "balance" INTEGER NOT NULL DEFAULT 0,
    "total_purchased" INTEGER NOT NULL DEFAULT 0,
    "total_consumed" INTEGER NOT NULL DEFAULT 0,
    "low_balance_threshold" INTEGER NOT NULL DEFAULT 20,
    "low_balance_warned" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tenant_sms_wallets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "sms_credit_transactions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "type" "SmsCreditTransactionType" NOT NULL,
    "amount" INTEGER NOT NULL,
    "balance_after" INTEGER NOT NULL,
    "reference" TEXT,
    "payment_order_id" UUID,
    "package_id" UUID,
    "description" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sms_credit_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "sms_message_logs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "recipient" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "purpose" TEXT NOT NULL DEFAULT 'GENERAL',
    "segments" INTEGER NOT NULL DEFAULT 1,
    "credits_deducted" INTEGER NOT NULL DEFAULT 1,
    "status" "SmsDeliveryStatus" NOT NULL DEFAULT 'PENDING',
    "provider" TEXT NOT NULL DEFAULT 'SMSLENZ',
    "provider_message_id" TEXT,
    "provider_error" TEXT,
    "idempotency_key" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sms_message_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "sms_packages_is_active_idx" ON "sms_packages"("is_active");
CREATE INDEX IF NOT EXISTS "sms_packages_display_order_idx" ON "sms_packages"("display_order");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "tenant_sms_wallets_tenant_id_key" ON "tenant_sms_wallets"("tenant_id");
CREATE INDEX IF NOT EXISTS "tenant_sms_wallets_tenant_id_idx" ON "tenant_sms_wallets"("tenant_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "sms_credit_transactions_tenant_id_idx" ON "sms_credit_transactions"("tenant_id");
CREATE INDEX IF NOT EXISTS "sms_credit_transactions_type_idx" ON "sms_credit_transactions"("type");
CREATE INDEX IF NOT EXISTS "sms_credit_transactions_created_at_idx" ON "sms_credit_transactions"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "sms_message_logs_idempotency_key_key" ON "sms_message_logs"("idempotency_key");
CREATE INDEX IF NOT EXISTS "sms_message_logs_tenant_id_idx" ON "sms_message_logs"("tenant_id");
CREATE INDEX IF NOT EXISTS "sms_message_logs_status_idx" ON "sms_message_logs"("status");
CREATE INDEX IF NOT EXISTS "sms_message_logs_created_at_idx" ON "sms_message_logs"("created_at");

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tenant_sms_wallets_tenant_id_fkey') THEN
        ALTER TABLE "tenant_sms_wallets" ADD CONSTRAINT "tenant_sms_wallets_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sms_credit_transactions_tenant_id_fkey') THEN
        ALTER TABLE "sms_credit_transactions" ADD CONSTRAINT "sms_credit_transactions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sms_credit_transactions_package_id_fkey') THEN
        ALTER TABLE "sms_credit_transactions" ADD CONSTRAINT "sms_credit_transactions_package_id_fkey" FOREIGN KEY ("package_id") REFERENCES "sms_packages"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sms_credit_transactions_payment_order_id_fkey') THEN
        ALTER TABLE "sms_credit_transactions" ADD CONSTRAINT "sms_credit_transactions_payment_order_id_fkey" FOREIGN KEY ("payment_order_id") REFERENCES "payment_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sms_message_logs_tenant_id_fkey') THEN
        ALTER TABLE "sms_message_logs" ADD CONSTRAINT "sms_message_logs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
