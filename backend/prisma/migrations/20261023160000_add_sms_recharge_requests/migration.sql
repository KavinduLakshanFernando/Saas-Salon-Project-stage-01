-- CreateEnum
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'SmsRechargeRequestStatus') THEN
        CREATE TYPE "SmsRechargeRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'FULFILLED', 'REJECTED', 'CANCELLED');
    END IF;
END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "sms_recharge_requests" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "package_id" UUID,
    "requested_credits" INTEGER NOT NULL,
    "amount" DECIMAL(10,2),
    "owner_message" TEXT,
    "status" "SmsRechargeRequestStatus" NOT NULL DEFAULT 'PENDING',
    "admin_notes" TEXT,
    "actioned_by_admin_id" UUID,
    "credit_transaction_id" UUID,
    "fulfilled_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sms_recharge_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "sms_recharge_requests_credit_transaction_id_key" ON "sms_recharge_requests"("credit_transaction_id");
CREATE INDEX IF NOT EXISTS "sms_recharge_requests_tenant_id_idx" ON "sms_recharge_requests"("tenant_id");
CREATE INDEX IF NOT EXISTS "sms_recharge_requests_status_idx" ON "sms_recharge_requests"("status");
CREATE INDEX IF NOT EXISTS "sms_recharge_requests_created_at_idx" ON "sms_recharge_requests"("created_at");
CREATE INDEX IF NOT EXISTS "sms_recharge_requests_actioned_by_admin_id_idx" ON "sms_recharge_requests"("actioned_by_admin_id");

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sms_recharge_requests_tenant_id_fkey') THEN
        ALTER TABLE "sms_recharge_requests" ADD CONSTRAINT "sms_recharge_requests_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sms_recharge_requests_package_id_fkey') THEN
        ALTER TABLE "sms_recharge_requests" ADD CONSTRAINT "sms_recharge_requests_package_id_fkey" FOREIGN KEY ("package_id") REFERENCES "sms_packages"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sms_recharge_requests_actioned_by_admin_id_fkey') THEN
        ALTER TABLE "sms_recharge_requests" ADD CONSTRAINT "sms_recharge_requests_actioned_by_admin_id_fkey" FOREIGN KEY ("actioned_by_admin_id") REFERENCES "super_admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sms_recharge_requests_credit_transaction_id_fkey') THEN
        ALTER TABLE "sms_recharge_requests" ADD CONSTRAINT "sms_recharge_requests_credit_transaction_id_fkey" FOREIGN KEY ("credit_transaction_id") REFERENCES "sms_credit_transactions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;
