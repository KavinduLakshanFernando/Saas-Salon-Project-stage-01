import 'dotenv/config';
import {
  PrismaClient,
  SubscriptionStatus,
  TenantStatus,
  BillingCycle,
  NotificationType,
  NotificationChannel,
  InAppNotificationStatus,
  SubscriptionReminderType,
  SubscriptionReminderStatus,
  PaymentOrderStatus,
  PaymentGatewayProvider,
  PaymentRecordStatus,
} from '@prisma/client';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { TenantProvisioningService } from '../src/database/tenant-provisioning.service';
import { PrismaService } from '../src/database/prisma.service';

const prisma = new PrismaClient();

const TEST_TENANT_CODE = 'SAL-TEST-TRIAL';
const TEST_TENANT_NAME = 'Trial Lifecycle Test Salon';
const TEST_SCHEMA_NAME = 'tenant_trial_test_000999';
const TEST_ADMIN_EMAIL = 'trial.tester@salon.local';
const TEST_ADMIN_PASSWORD = 'TrialPass123!';
const TEST_PHONE = '0771234567';

function assertDevelopmentOnly() {
  if (process.env.NODE_ENV === 'production') {
    console.error('❌ ERROR: This test script is strictly for development environments and cannot run in production.');
    process.exit(1);
  }
}

async function getTestTenant() {
  return prisma.tenant.findUnique({
    where: { code: TEST_TENANT_CODE },
    include: {
      subscriptions: {
        include: { plan: true },
        orderBy: { createdAt: 'desc' },
      },
    },
  });
}

async function getOrCreatePlan() {
  const plan = await prisma.plan.findFirst({
    where: { status: 'ACTIVE', code: { not: 'CUSTOM' } },
    include: { planPrices: true, planFeatures: { include: { feature: true } } },
    orderBy: { displayOrder: 'asc' },
  });

  if (!plan) {
    throw new Error('No active subscription plans found in the database. Run `npm run db:seed` first.');
  }

  const monthlyPrice = plan.planPrices.find((p) => p.billingCycle === BillingCycle.MONTHLY) ?? plan.planPrices[0];
  return { plan, planPrice: monthlyPrice };
}

async function setupTestTenant() {
  assertDevelopmentOnly();
  console.log('\n================================================================================');
  console.log(`SETTING UP ISOLATED TEST TENANT: ${TEST_TENANT_CODE}`);
  console.log('================================================================================\n');

  let tenant = await prisma.tenant.findUnique({ where: { code: TEST_TENANT_CODE } });

  if (!tenant) {
    console.log(`Creating test tenant record "${TEST_TENANT_NAME}"...`);
    tenant = await prisma.tenant.create({
      data: {
        code: TEST_TENANT_CODE,
        name: TEST_TENANT_NAME,
        schemaName: TEST_SCHEMA_NAME,
        email: TEST_ADMIN_EMAIL,
        phone: TEST_PHONE,
        status: TenantStatus.ACTIVE,
      },
    });
  } else if (tenant.schemaName !== TEST_SCHEMA_NAME) {
    tenant = await prisma.tenant.update({
      where: { id: tenant.id },
      data: { schemaName: TEST_SCHEMA_NAME },
    });
  }

  // Provision Schema and Admin User
  const prismaService = new PrismaService();
  await prismaService.$connect();
  const provisioningService = new TenantProvisioningService(prismaService);

  console.log(`Ensuring schema "${TEST_SCHEMA_NAME}" is provisioned with migrations and admin user...`);
  const result = await provisioningService.provisionTenantSchema({
    tenantCode: TEST_TENANT_CODE,
    schemaName: TEST_SCHEMA_NAME,
    mainBranchName: 'Main Test Branch',
    adminUser: {
      name: 'Trial Test Admin',
      email: TEST_ADMIN_EMAIL,
      phone: TEST_PHONE,
      password: TEST_ADMIN_PASSWORD,
    },
  });

  if (!result.success && !result.error?.includes('already exists')) {
    console.warn('Provisioning note:', result.error);
  }

  // Ensure password is up to date
  const passwordHash = await bcrypt.hash(TEST_ADMIN_PASSWORD, 10);
  try {
    await prisma.$executeRawUnsafe(
      `UPDATE "${TEST_SCHEMA_NAME}".users SET "passwordHash" = $1 WHERE email = $2`,
      passwordHash,
      TEST_ADMIN_EMAIL,
    );
  } catch (err) {
    // In case column is password_hash or passwordHash
    try {
      await prisma.$executeRawUnsafe(
        `UPDATE "${TEST_SCHEMA_NAME}".users SET "password_hash" = $1 WHERE email = $2`,
        passwordHash,
        TEST_ADMIN_EMAIL,
      );
    } catch {}
  }

  // Insert a sample customer and appointment in the isolated test schema to simulate preserved salon data
  try {
    const custCount = await prisma.$queryRawUnsafe<Array<{ count: bigint }>>(
      `SELECT count(*)::int as count FROM "${TEST_SCHEMA_NAME}".customers`,
    );
    if (!custCount[0] || Number(custCount[0].count) === 0) {
      const custId = crypto.randomUUID();
      await prisma.$executeRawUnsafe(
        `INSERT INTO "${TEST_SCHEMA_NAME}".customers (id, name, email, phone, "createdAt", "updatedAt") 
         VALUES ($1::uuid, 'Alice Walker (Test Client)', 'alice.test@client.local', '0779998877', NOW(), NOW())`,
        custId,
      );
      console.log('✓ Seeded sample client into test schema.');
    }
  } catch (err: any) {
    // Non-fatal if schema structure differs
  }

  // Ensure subscription exists
  const { plan, planPrice } = await getOrCreatePlan();
  let sub = await prisma.subscription.findFirst({
    where: { tenantId: tenant.id },
  });

  if (!sub) {
    const now = new Date();
    const trialEnd = new Date(now.getTime() + 20 * 24 * 60 * 60 * 1000 + 12 * 60 * 60 * 1000);
    sub = await prisma.subscription.create({
      data: {
        tenantId: tenant.id,
        planId: plan.id,
        planPriceId: planPrice?.id,
        status: SubscriptionStatus.TRIAL,
        billingCycle: planPrice?.billingCycle ?? BillingCycle.MONTHLY,
        price: planPrice?.price ?? 4900,
        currency: planPrice?.currency ?? 'LKR',
        trialStart: now,
        trialEnd,
        startDate: now,
        endDate: trialEnd,
        nextBillingDate: trialEnd,
      },
    });

    // Snapshot plan features
    for (const pf of plan.planFeatures) {
      if (pf.enabled) {
        await prisma.tenantFeature.upsert({
          where: { tenantId_featureId: { tenantId: tenant.id, featureId: pf.featureId } },
          update: { isEnabled: true },
          create: { tenantId: tenant.id, featureId: pf.featureId, isEnabled: true },
        });
      }
    }
  }

  console.log('\n================================================================================');
  console.log('TEST TENANT SETUP COMPLETED SUCCESSFULLY ✓');
  console.log('================================================================================');
  console.log(`Salon Code   : ${TEST_TENANT_CODE}`);
  console.log(`Salon Name   : ${TEST_TENANT_NAME}`);
  console.log(`Admin Login  : ${TEST_ADMIN_EMAIL}`);
  console.log(`Password     : ${TEST_ADMIN_PASSWORD}`);
  console.log(`Login URL    : http://localhost:5173/salon/login`);
  console.log('================================================================================\n');

  await printStatus();
}

async function setScenario(scenarioNumber: 1 | 2 | 3 | 4 | 5) {
  assertDevelopmentOnly();
  const tenant = await getTestTenant();
  if (!tenant || !tenant.subscriptions[0]) {
    console.error(`❌ Test tenant ${TEST_TENANT_CODE} not found. Run setup first:`);
    console.error(`   npm run test:trial-scenario setup\n`);
    process.exit(1);
  }

  const sub = tenant.subscriptions[0];
  const now = new Date();

  // Clear existing reminders and test notifications for this tenant
  await prisma.subscriptionReminder.deleteMany({ where: { tenantId: tenant.id } });
  await prisma.notification.deleteMany({ where: { tenantId: tenant.id } });

  console.log('\n================================================================================');
  console.log(`APPLYING SCENARIO ${scenarioNumber} TO TEST TENANT: ${TEST_TENANT_CODE}`);
  console.log('================================================================================');

  switch (scenarioNumber) {
    case 1: {
      // 1. Trial Day 1 — 20 days remaining
      const trialStart = now;
      const trialEnd = new Date(now.getTime() + 20 * 24 * 60 * 60 * 1000 + 12 * 60 * 60 * 1000);

      await prisma.subscription.update({
        where: { id: sub.id },
        data: {
          status: SubscriptionStatus.TRIAL,
          trialStart,
          trialEnd,
          startDate: trialStart,
          endDate: trialEnd,
          nextBillingDate: trialEnd,
        },
      });

      // Enable plan features in tenant cache
      await prisma.tenantFeature.updateMany({
        where: { tenantId: tenant.id },
        data: { isEnabled: true },
      });

      console.log('State: TRIAL (Day 1 of 21)');
      console.log('Remaining Days: 20 days remaining');
      console.log('Write Access: ALLOWED (Full Unrestricted Access)');
      console.log('\nBrowser Verification:');
      console.log('  1. Log in at http://localhost:5173/salon/login with trial.tester@salon.local / TrialPass123!');
      console.log('  2. Verify Header Pill: Purple pill "FREE TRIAL • 20 days left • Plans ->"');
      console.log('  3. Verify No Duplicate Down Banner below header.');
      console.log('  4. Create a test appointment or service to verify full write access.');
      break;
    }

    case 2: {
      // 2. Trial Day 14 — 7 days remaining
      const trialStart = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
      const trialEnd = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000 - 3600 * 1000);

      await prisma.subscription.update({
        where: { id: sub.id },
        data: {
          status: SubscriptionStatus.TRIAL,
          trialStart,
          trialEnd,
          startDate: trialStart,
          endDate: trialEnd,
          nextBillingDate: trialEnd,
        },
      });

      // Record Day 14 milestone reminder & in-app notification
      await prisma.subscriptionReminder.create({
        data: {
          tenantId: tenant.id,
          subscriptionId: sub.id,
          reminderType: SubscriptionReminderType.SEVEN_DAYS_BEFORE,
          targetDate: now,
          status: SubscriptionReminderStatus.SENT,
          channels: [NotificationChannel.EMAIL, NotificationChannel.IN_APP],
          inAppSent: true,
          emailSent: true,
          sentAt: now,
        },
      });

      await prisma.notification.create({
        data: {
          tenantId: tenant.id,
          type: NotificationType.TRIAL_EXPIRY_REMINDER,
          title: 'Trial Ending Soon (7 Days Remaining)',
          message: 'Your 21-day free trial will expire in 7 days. Upgrade your plan now to ensure continuous access.',
          status: InAppNotificationStatus.UNREAD,
        },
      });

      console.log('State: TRIAL (Day 14 of 21)');
      console.log('Remaining Days: 7 days remaining');
      console.log('Write Access: ALLOWED');
      console.log('\nBrowser Verification:');
      console.log('  1. Check Header Pill: Amber warning pill "TRIAL ENDING SOON • 7 days left • Upgrade ->"');
      console.log('  2. Check In-App Notification Bell: 1 unread notification "Trial Ending Soon (7 Days Remaining)".');
      console.log('  3. Click "Upgrade ->" to open the subscription plan comparison.');
      break;
    }

    case 3: {
      // 3. Trial Day 20 — 1 day remaining
      const trialStart = new Date(now.getTime() - 20 * 24 * 60 * 60 * 1000);
      const trialEnd = new Date(now.getTime() + 24 * 60 * 60 * 1000 - 1800 * 1000);

      await prisma.subscription.update({
        where: { id: sub.id },
        data: {
          status: SubscriptionStatus.TRIAL,
          trialStart,
          trialEnd,
          startDate: trialStart,
          endDate: trialEnd,
          nextBillingDate: trialEnd,
        },
      });

      // Record Day 20 milestone reminder & in-app urgent notification
      await prisma.subscriptionReminder.create({
        data: {
          tenantId: tenant.id,
          subscriptionId: sub.id,
          reminderType: SubscriptionReminderType.ONE_DAY_BEFORE,
          targetDate: now,
          status: SubscriptionReminderStatus.SENT,
          channels: [NotificationChannel.EMAIL, NotificationChannel.IN_APP, NotificationChannel.SMS],
          inAppSent: true,
          emailSent: true,
          smsSent: true,
          sentAt: now,
        },
      });

      await prisma.notification.create({
        data: {
          tenantId: tenant.id,
          type: NotificationType.TRIAL_EXPIRY_REMINDER,
          title: 'Urgent: Free Trial Ends Tomorrow',
          message: 'Your trial expires in 24 hours. Activate a paid plan to prevent your salon from entering read-only mode.',
          status: InAppNotificationStatus.UNREAD,
        },
      });

      console.log('State: TRIAL (Day 20 of 21)');
      console.log('Remaining Days: 1 day remaining');
      console.log('Write Access: ALLOWED (Active urgent reminder)');
      console.log('\nBrowser Verification:');
      console.log('  1. Check Header Pill: Rose urgent pill with pulsing dot "1 Day Left in Trial • Upgrade ->"');
      console.log('  2. Check Notification Bell: Urgent notification with 1-day deadline.');
      break;
    }

    case 4: {
      // 4. Trial Expired — Read-Only Mode
      const trialStart = new Date(now.getTime() - 22 * 24 * 60 * 60 * 1000);
      const trialEnd = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      await prisma.subscription.update({
        where: { id: sub.id },
        data: {
          status: SubscriptionStatus.SUSPENDED,
          trialStart,
          trialEnd,
          startDate: trialStart,
          endDate: trialEnd,
          nextBillingDate: trialEnd,
        },
      });

      // Disable features cache
      await prisma.tenantFeature.updateMany({
        where: { tenantId: tenant.id },
        data: { isEnabled: false },
      });

      console.log('State: SUSPENDED (Trial Expired)');
      console.log('Remaining Days: 0 (Expired)');
      console.log('Write Access: BLOCKED by SubscriptionWriteGuard (Read-Only Mode)');
      console.log('Salon Data: SAFE & PRESERVED (Clients, bookings, catalog all intact)');
      console.log('\nBrowser Verification:');
      console.log('  1. Check Header Pill: Red pill "Trial Expired • Read-Only Mode • Pay Now ->"');
      console.log('  2. In Dashboard: View existing records normally.');
      console.log('  3. In POS or Appointments: Attempting a checkout or new booking returns HTTP 403 Subscription Suspended.');
      console.log('  4. In Subscription Page (/salon/subscription):');
      console.log('     - Hero banner "Your 21-Day Free Trial Has Ended" is visible.');
      console.log('     - Plan cards (Monthly / Yearly) are rendered with "Choose Plan & Pay Now".');
      console.log('     - Clicking "Choose Plan & Pay Now" connects directly to PayHere Checkout.');
      break;
    }

    case 5: {
      // 5. Active Paid Subscription — Full Access Restored
      const startDate = now;
      const endDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

      await prisma.subscription.update({
        where: { id: sub.id },
        data: {
          status: SubscriptionStatus.ACTIVE,
          startDate,
          endDate,
          nextBillingDate: endDate,
        },
      });

      // Restore tenant features
      await prisma.tenantFeature.updateMany({
        where: { tenantId: tenant.id },
        data: { isEnabled: true },
      });

      // Record a paid payment order and payment record
      const orderRef = `ORD-TEST-${Date.now().toString(36).toUpperCase()}`;
      const order = await prisma.paymentOrder.create({
        data: {
          tenantId: tenant.id,
          subscriptionId: sub.id,
          reference: orderRef,
          amount: sub.price,
          currency: sub.currency,
          purpose: 'SUBSCRIPTION_ACTIVATE',
          status: PaymentOrderStatus.PAID,
          gateway: PaymentGatewayProvider.PAYHERE,
          metadata: { planId: sub.planId, billingCycle: sub.billingCycle },
        },
      });

      await prisma.payment.create({
        data: {
          paymentOrderId: order.id,
          transactionId: `TXN-${Date.now()}`,
          status: PaymentRecordStatus.PAID,
          paidAt: now,
        },
      });

      console.log('State: ACTIVE (Paid Subscription)');
      console.log('Billing Period: 30 days active renewal');
      console.log('Write Access: RESTORED (Full platform write capability)');
      console.log('\nBrowser Verification:');
      console.log('  1. Check Header: Header pill is hidden (returns null for paid active accounts).');
      console.log('  2. Check Dashboard: Clean header, zero warnings.');
      console.log('  3. Check Subscription Page (/salon/subscription):');
      console.log('     - Status badge: ACTIVE (Green).');
      console.log('     - Payment History displays verified transaction reference ' + orderRef + '.');
      console.log('     - Invoices section displays download/email options.');
      console.log('  4. Check write operations: New bookings, clients, and POS checkouts succeed.');
      break;
    }
  }

  console.log('================================================================================\n');
}

async function simulatePayHereWebhook(orderRef: string) {
  assertDevelopmentOnly();
  if (!orderRef) {
    console.error('❌ Please provide an order reference:');
    console.error('   npm run test:trial-scenario payhere-notify <orderRef>\n');
    process.exit(1);
  }

  const order = await prisma.paymentOrder.findUnique({
    where: { reference: orderRef },
    include: { tenant: true },
  });

  if (!order) {
    console.error(`❌ Payment order with reference "${orderRef}" not found in database.`);
    process.exit(1);
  }

  const merchantId = process.env.PAYHERE_MERCHANT_ID || '1234567';
  const merchantSecret = process.env.PAYHERE_MERCHANT_SECRET || 'secret';
  const paymentId = `TEST_PAYHERE_${Date.now()}`;
  const statusCode = '2'; // 2 = SUCCESS in PayHere
  const formattedAmount = Number(order.amount).toFixed(2);

  // Official PayHere MD5 signature algorithm
  const secretHash = crypto.createHash('md5').update(merchantSecret).digest('hex').toUpperCase();
  const rawSignatureString = `${merchantId}${order.reference}${formattedAmount}${order.currency}${statusCode}${secretHash}`;
  const signature = crypto.createHash('md5').update(rawSignatureString).digest('hex').toUpperCase();

  const ipnPayload = new URLSearchParams({
    merchant_id: merchantId,
    order_id: order.reference,
    payment_id: paymentId,
    payhere_amount: formattedAmount,
    payhere_currency: order.currency,
    status_code: statusCode,
    status_message: 'Successfully completed development sandbox payment',
    md5sig: signature,
    method: 'VISA',
    custom_1: order.tenantId,
    custom_2: order.subscriptionId || '',
  });

  console.log(`\nDispatching verified PayHere webhook for order: ${order.reference}...`);
  try {
    const backendUrl = process.env.BACKEND_URL || 'http://localhost:3000';
    const response = await fetch(`${backendUrl}/payments/payhere/notify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: ipnPayload.toString(),
    });

    const text = await response.text();
    if (response.ok) {
      console.log('✓ PayHere Webhook Processed Successfully by Backend (HTTP ' + response.status + '):', text);
      console.log('✓ Subscription has been activated in database.');
      console.log('✓ Check your browser window on the subscription page — it will transition to "Subscription Activated!"');
    } else {
      console.error('❌ Webhook error response:', response.status, text);
    }
  } catch (err: any) {
    console.error('❌ Failed to reach backend at http://localhost:3000/payments/payhere/notify:', err.message);
  }
}

async function printStatus() {
  const tenant = await getTestTenant();
  if (!tenant) {
    console.log(`\nTest tenant ${TEST_TENANT_CODE} is not provisioned yet.`);
    console.log('Run: npm run test:trial-scenario setup\n');
    return;
  }

  const sub = tenant.subscriptions[0];
  const reminders = await prisma.subscriptionReminder.findMany({ where: { tenantId: tenant.id } });
  const notifications = await prisma.notification.findMany({ where: { tenantId: tenant.id } });

  console.log('================================================================================');
  console.log('CURRENT TEST TENANT STATUS:');
  console.log('================================================================================');
  console.log(`Tenant Name   : ${tenant.name} (${tenant.code})`);
  console.log(`Schema Name   : ${tenant.schemaName}`);
  console.log(`Login Email   : ${TEST_ADMIN_EMAIL}`);
  console.log(`Password      : ${TEST_ADMIN_PASSWORD}`);
  if (sub) {
    const now = Date.now();
    const trialEnd = sub.trialEnd ? new Date(sub.trialEnd).getTime() : 0;
    const daysRemaining = sub.trialEnd ? Math.max(0, Math.ceil((trialEnd - now) / (1000 * 60 * 60 * 24))) : null;

    console.log(`Subscription  : Status = ${sub.status}, Plan = ${sub.plan?.name}`);
    console.log(`Trial Start   : ${sub.trialStart?.toISOString() ?? 'N/A'}`);
    console.log(`Trial End     : ${sub.trialEnd?.toISOString() ?? 'N/A'}`);
    console.log(`Days Left     : ${daysRemaining !== null ? `${daysRemaining} days` : 'N/A'}`);
  }
  console.log(`Reminders Sent: ${reminders.map((r) => r.reminderType).join(', ') || 'None'}`);
  console.log(`Notifications : ${notifications.length} in-app notification(s)`);
  console.log('================================================================================\n');
}

async function main() {
  const cmd = process.argv[2]?.toLowerCase();
  const arg = process.argv[3];

  try {
    switch (cmd) {
      case 'setup':
      case 'provision':
        await setupTestTenant();
        break;
      case 'status':
        await printStatus();
        break;
      case 'scenario-1':
      case 'day-1':
      case '1':
        await setScenario(1);
        break;
      case 'scenario-2':
      case 'day-14':
      case '2':
        await setScenario(2);
        break;
      case 'scenario-3':
      case 'day-20':
      case '3':
        await setScenario(3);
        break;
      case 'scenario-4':
      case 'expired':
      case '4':
        await setScenario(4);
        break;
      case 'scenario-5':
      case 'active':
      case 'paid':
      case '5':
        await setScenario(5);
        break;
      case 'payhere-notify':
      case 'webhook':
        await simulatePayHereWebhook(arg);
        break;
      case 'reset':
        await setScenario(1);
        break;
      default:
        console.log(`
Usage: npm run test:trial-scenario <command>

Available commands:
  setup              Provision the isolated test tenant (${TEST_TENANT_CODE})
  status             Show current test tenant subscription & reminders state
  scenario-1 (day-1) Set to Trial Day 1 (20 days remaining, informational purple pill)
  scenario-2 (day-14)Set to Trial Day 14 (7 days remaining, amber warning pill & notification)
  scenario-3 (day-20)Set to Trial Day 20 (1 day remaining, urgent rose pill & notification)
  scenario-4 (expired)Set to Trial Expired (read-only mode, trial-expired hero & plan checkout)
  scenario-5 (active) Set to Active Paid Subscription (clean header, full write access)
  payhere-notify <orderRef> Dispatch official PayHere webhook with verified MD5 signature
  reset              Reset test tenant back to Scenario 1 (Day 1)
`);
        break;
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error('Fatal script error:', err);
  process.exit(1);
});
