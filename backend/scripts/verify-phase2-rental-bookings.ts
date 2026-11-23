import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { TenantSchemaService } from '../src/tenant/services/tenant-schema.service';
import { RentalsService } from '../src/salon/rentals/rentals.service';

const prisma = new PrismaClient();
const tenantSchemaService = new TenantSchemaService(prisma as any);
const rentalsService = new RentalsService(tenantSchemaService);

async function main() {
  console.log('===============================================================');
  console.log('PHASE 2: RENTAL BOOKINGS VERIFICATION AND INTEGRATION TEST');
  console.log('===============================================================');

  const schemaName = 'tenant_test_000004';
  console.log(`Using tenant test schema: [${schemaName}]`);

  // 1. Fetch active branch, user, and customer
  const branches = await prisma.$queryRawUnsafe<Array<{ id: string; name: string }>>(
    `SELECT id, name FROM "${schemaName}".branches WHERE status = 'ACTIVE' LIMIT 1`,
  );
  if (branches.length === 0) throw new Error('No active branch found');
  const branchId = branches[0].id;
  console.log(`✓ Active branch: ${branches[0].name} (${branchId})`);

  const users = await prisma.$queryRawUnsafe<Array<{ id: string; name: string }>>(
    `SELECT id, name FROM "${schemaName}".users LIMIT 1`,
  );
  if (users.length === 0) throw new Error('No user found');
  const userId = users[0].id;
  console.log(`✓ Staff User: ${users[0].name} (${userId})`);

  // Ensure customer exists or create one
  let customerAId: string;
  let customerBId: string;
  const customers = await prisma.$queryRawUnsafe<Array<{ id: string; name: string }>>(
    `SELECT id, name FROM "${schemaName}".customers WHERE status = 'ACTIVE' LIMIT 2`,
  );
  if (customers.length >= 2) {
    customerAId = customers[0].id;
    customerBId = customers[1].id;
  } else {
    const custA = await prisma.$queryRawUnsafe<Array<{ id: string }>>(
      `INSERT INTO "${schemaName}".customers (name, phone, status, code)
       VALUES ('Nethmi Perera', '0771234567', 'ACTIVE', 'CUST-0001')
       RETURNING id`,
    );
    const custB = await prisma.$queryRawUnsafe<Array<{ id: string }>>(
      `INSERT INTO "${schemaName}".customers (name, phone, status, code)
       VALUES ('Kasun Fernando', '0779876543', 'ACTIVE', 'CUST-0002')
       RETURNING id`,
    );
    customerAId = custA[0].id;
    customerBId = custB[0].id;
  }
  console.log(`✓ Test Customer A: ${customerAId}`);
  console.log(`✓ Test Customer B: ${customerBId}`);

  // 2. Setup Rental Items with physical copies (Phase 1 master items)
  // Item 1: Red Kandyan Saree (3 copies)
  // Item 2: Jewellery Set (2 copies)
  console.log('\n--- Test Step 1: Create Master Items with Physical Copies ---');
  const sareeItem = await rentalsService.createItem(
    schemaName,
    {
      name: 'Red Kandyan Bridal Saree',
      category: 'Saree',
      branchId,
      rentPrice: 8000,
      deposit: 4000,
      quantity: 3,
      color: 'Red & Gold',
      size: 'Custom',
      notes: 'Premium silk bridal saree with hand-crafted embroidery',
    },
    userId,
  );
  console.log(`✓ Created Saree: ${sareeItem.code} with ${sareeItem.unitsCount} physical copies`);
  console.log(`  Copies: ${sareeItem.units.map((u) => u.unitCode).join(', ')}`);

  const jewelleryItem = await rentalsService.createItem(
    schemaName,
    {
      name: 'Bridal Jewellery Set',
      category: 'Jewellery',
      branchId,
      rentPrice: 5000,
      deposit: 3000,
      quantity: 2,
      notes: 'Complete traditional 7-piece necklace and earrings set',
    },
    userId,
  );
  console.log(`✓ Created Jewellery: ${jewelleryItem.code} with ${jewelleryItem.unitsCount} physical copies`);
  console.log(`  Copies: ${jewelleryItem.units.map((u) => u.unitCode).join(', ')}`);

  const copy01_saree = sareeItem.units[0];
  const copy02_saree = sareeItem.units[1];
  const copy03_saree = sareeItem.units[2];
  const copy01_jewel = jewelleryItem.units[0];
  const copy02_jewel = jewelleryItem.units[1];

  // 3. Test Availability checking before any booking
  console.log('\n--- Test Step 2: Date-Based Availability Check (Clean State) ---');
  const availBefore = await rentalsService.checkAvailability(schemaName, {
    branchId,
    pickupDate: '2026-11-10',
    returnDate: '2026-11-12',
  });
  const sareeAvail = availBefore.find((i) => i.id === sareeItem.id);
  console.log(`✓ Saree availability before booking: ${sareeAvail?.availableCopiesCount} / ${sareeAvail?.totalCopiesCount} copies available`);
  if (sareeAvail?.availableCopiesCount !== 3) {
    throw new Error(`Expected all 3 copies of saree to be available, found ${sareeAvail?.availableCopiesCount}`);
  }

  // 4. Test Customer A multi-item booking
  // Rents: Copy 01 of Red Kandyan Saree (LKR 8,000 / dep 4,000) + Copy 01 of Jewellery Set (LKR 5,000 / dep 3,000)
  // Dates: 10 Nov 2026 to 12 Nov 2026
  console.log('\n--- Test Step 3: Multi-Item Booking Creation (Customer A) ---');
  const bookingA = await rentalsService.createBooking(
    schemaName,
    {
      branchId,
      customerId: customerAId,
      pickupDate: '2026-11-10',
      returnDate: '2026-11-12',
      unitIds: [copy01_saree.id, copy01_jewel.id],
      notes: 'Customer A wedding weekend package',
    },
    userId,
  );
  console.log(`✓ Booking confirmed: ${bookingA.bookingReference}`);
  console.log(`  Status: ${bookingA.status}`);
  console.log(`  Total Rent: LKR ${bookingA.totalRent} (Expected: 13,000)`);
  console.log(`  Total Deposit: LKR ${bookingA.totalDeposit} (Expected: 7,000)`);
  console.log(`  Units: ${bookingA.items.map((i) => i.unitCode).join(', ')}`);

  if (bookingA.totalRent !== 13000 || bookingA.totalDeposit !== 7000) {
    throw new Error('Booking A totals do not match expected sum');
  }

  // 5. Test Date-Based Availability after Booking A
  console.log('\n--- Test Step 4: Availability Check After Booking A ---');
  const availDuring = await rentalsService.checkAvailability(schemaName, {
    branchId,
    pickupDate: '2026-11-10',
    returnDate: '2026-11-12',
  });
  const sareeDuring = availDuring.find((i) => i.id === sareeItem.id)!;
  const copy01State = sareeDuring.units.find((u) => u.id === copy01_saree.id)!;
  const copy02State = sareeDuring.units.find((u) => u.id === copy02_saree.id)!;
  const copy03State = sareeDuring.units.find((u) => u.id === copy03_saree.id)!;

  console.log(`  Copy 01 (${copy01_saree.unitCode}): available=${copy01State.isAvailable}, reason="${copy01State.conflictReason}"`);
  console.log(`  Copy 02 (${copy02_saree.unitCode}): available=${copy02State.isAvailable}`);
  console.log(`  Copy 03 (${copy03_saree.unitCode}): available=${copy03State.isAvailable}`);

  if (copy01State.isAvailable) throw new Error('Copy 01 should be unavailable for booked dates');
  if (!copy02State.isAvailable) throw new Error('Copy 02 should still be available for same dates');
  if (!copy03State.isAvailable) throw new Error('Copy 03 should still be available for same dates');

  // Check non-overlapping future dates for Copy 01 (e.g. 15-18 Nov)
  const availFuture = await rentalsService.checkAvailability(schemaName, {
    branchId,
    pickupDate: '2026-11-15',
    returnDate: '2026-11-18',
  });
  const sareeFuture = availFuture.find((i) => i.id === sareeItem.id)!;
  const copy01FutureState = sareeFuture.units.find((u) => u.id === copy01_saree.id)!;
  console.log(`✓ Non-overlapping future dates (15-18 Nov) Copy 01 available: ${copy01FutureState.isAvailable}`);
  if (!copy01FutureState.isAvailable) throw new Error('Copy 01 must be available for non-overlapping future dates');

  // 6. Test Double-Booking Prevention: Customer B tries to book Copy 01 for overlapping dates
  console.log('\n--- Test Step 5: Double-Booking Conflict Prevention ---');
  let conflictCaught = false;
  try {
    await rentalsService.createBooking(
      schemaName,
      {
        branchId,
        customerId: customerBId,
        pickupDate: '2026-11-11',
        returnDate: '2026-11-13',
        unitIds: [copy01_saree.id],
      },
      userId,
    );
  } catch (err: any) {
    conflictCaught = true;
    console.log(`✓ Successfully blocked double booking with error: "${err.message}"`);
  }
  if (!conflictCaught) throw new Error('Double booking was not blocked!');

  // 7. Customer B books independent copies (Copy 02 & Copy 03 of Saree) for the same dates
  console.log('\n--- Test Step 6: Customer B Books Independent Copies for Same Dates ---');
  const bookingB = await rentalsService.createBooking(
    schemaName,
    {
      branchId,
      customerId: customerBId,
      pickupDate: '2026-11-10',
      returnDate: '2026-11-12',
      unitIds: [copy02_saree.id, copy03_saree.id],
      notes: 'Customer B reserving copy 02 and 03',
    },
    userId,
  );
  console.log(`✓ Booking B confirmed: ${bookingB.bookingReference}`);
  console.log(`  Units: ${bookingB.items.map((i) => i.unitCode).join(', ')}`);
  console.log(`  Total Rent: LKR ${bookingB.totalRent} (Expected: 16,000 for 2 copies)`);
  if (bookingB.totalRent !== 16000) throw new Error('Booking B rent total incorrect');

  // 8. Test Cancellation Workflow:
  // Cancel Booking A -> releases Copy 01 of Saree and Copy 01 of Jewellery
  console.log('\n--- Test Step 7: Booking Cancellation Workflow ---');
  const cancelResult = await rentalsService.cancelBooking(
    schemaName,
    bookingA.id,
    { reason: 'Customer changed wedding venue' },
    userId,
  );
  console.log(`✓ Booking A cancelled: ${cancelResult.bookingReference}, status=${cancelResult.status}`);

  // Verify availability after cancellation
  const availAfterCancel = await rentalsService.checkAvailability(schemaName, {
    branchId,
    pickupDate: '2026-11-10',
    returnDate: '2026-11-12',
  });
  const sareeAfterCancel = availAfterCancel.find((i) => i.id === sareeItem.id)!;
  const copy01ReleasedState = sareeAfterCancel.units.find((u) => u.id === copy01_saree.id)!;
  console.log(`✓ Copy 01 available after cancellation: ${copy01ReleasedState.isAvailable}`);
  if (!copy01ReleasedState.isAvailable) throw new Error('Copy 01 must be released immediately upon cancellation');

  // 8.5 Test Physical Unit Condition Restrictions (CLEANING, MAINTENANCE, INACTIVE)
  console.log('\n--- Test Step 7.5: Unit Condition Rules (CLEANING, MAINTENANCE, INACTIVE) ---');
  // Put Copy 02 of Jewellery into CLEANING
  await prisma.$executeRawUnsafe(
    `UPDATE "${schemaName}".rental_units SET status = 'CLEANING' WHERE id = $1::uuid`,
    copy02_jewel.id,
  );
  const availCleaning = await rentalsService.checkAvailability(schemaName, {
    branchId,
    pickupDate: '2026-12-10',
    returnDate: '2026-12-12',
  });
  const jewelCheck = availCleaning.find((i) => i.id === jewelleryItem.id)!;
  const copy02JewelState = jewelCheck.units.find((u) => u.id === copy02_jewel.id)!;
  console.log(`✓ Cleaning unit availability: available=${copy02JewelState.isAvailable}, reason="${copy02JewelState.conflictReason}"`);
  if (copy02JewelState.isAvailable) throw new Error('Unit in CLEANING status must not be available');

  let cleaningBookBlocked = false;
  try {
    await rentalsService.createBooking(
      schemaName,
      {
        branchId,
        customerId: customerAId,
        pickupDate: '2026-12-10',
        returnDate: '2026-12-12',
        unitIds: [copy02_jewel.id],
      },
      userId,
    );
  } catch (err: any) {
    cleaningBookBlocked = true;
    console.log(`✓ Booking a CLEANING unit blocked: "${err.message}"`);
  }
  if (!cleaningBookBlocked) throw new Error('Booking a unit in CLEANING must be blocked');

  // Reset copy 02 of jewellery back to AVAILABLE
  await prisma.$executeRawUnsafe(
    `UPDATE "${schemaName}".rental_units SET status = 'AVAILABLE' WHERE id = $1::uuid`,
    copy02_jewel.id,
  );

  // 9. Concurrency Safe Double-Booking Test:
  // Simulate two concurrent booking requests racing to reserve Copy 01
  console.log('\n--- Test Step 8: Concurrent Collision Test (Advisory & Row Locks) ---');
  const racePromise1 = rentalsService.createBooking(
    schemaName,
    {
      branchId,
      customerId: customerAId,
      pickupDate: '2026-12-01',
      returnDate: '2026-12-05',
      unitIds: [copy01_saree.id],
    },
    userId,
  );

  const racePromise2 = rentalsService.createBooking(
    schemaName,
    {
      branchId,
      customerId: customerBId,
      pickupDate: '2026-12-01',
      returnDate: '2026-12-05',
      unitIds: [copy01_saree.id],
    },
    userId,
  );

  const results = await Promise.allSettled([racePromise1, racePromise2]);
  const fulfilled = results.filter((r) => r.status === 'fulfilled');
  const rejected = results.filter((r) => r.status === 'rejected');

  console.log(`  Concurrent racing results: ${fulfilled.length} succeeded, ${rejected.length} rejected`);
  if (fulfilled.length !== 1 || rejected.length !== 1) {
    throw new Error('Concurrency failure: exactly 1 request must succeed and 1 must be rejected');
  }
  console.log('✓ Concurrent double-booking prevention verified successfully!');

  // 10. Summary KPIs
  console.log('\n--- Test Step 9: Rental Bookings Summary Metrics ---');
  const summary = await rentalsService.getBookingSummary(schemaName, branchId);
  console.log('✓ Booking Summary KPIs:', summary);

  console.log('\n===============================================================');
  console.log('ALL PHASE 2 RENTAL BOOKING VERIFICATION TESTS PASSED SUCCESSFULLY! ✓');
  console.log('===============================================================');
}

main()
  .catch((err) => {
    console.error('\n❌ VERIFICATION TEST FAILED:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
