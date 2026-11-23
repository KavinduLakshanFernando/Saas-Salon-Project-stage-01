import { PrismaClient } from '@prisma/client';
import { RentalsService } from '../src/salon/rentals/rentals.service';
import { TenantSchemaService } from '../src/tenant/services/tenant-schema.service';

const prisma = new PrismaClient();

async function main() {
  console.log('--- Testing Rental Module Backend Services ---');
  await prisma.$connect();

  const schemaName = 'tenant_venus_000001';
  const tenantSchemaService = new TenantSchemaService(prisma as any);
  const rentalsService = new RentalsService(tenantSchemaService);

  // 1. Get a branch in the tenant schema
  const branches = await prisma.$queryRawUnsafe<Array<{ id: string; name: string }>>(
    `SELECT id, name FROM "${schemaName}".branches LIMIT 1`
  );
  if (!branches.length) {
    throw new Error('No branches found in ' + schemaName);
  }
  const branchId = branches[0].id;
  console.log(`Using branch: ${branches[0].name} (${branchId})`);

  // Get a user in the tenant schema
  const users = await prisma.$queryRawUnsafe<Array<{ id: string; name: string }>>(
    `SELECT id, name FROM "${schemaName}".users LIMIT 1`
  );
  if (!users.length) {
    throw new Error('No users found in ' + schemaName);
  }
  const testUserId = users[0].id;
  console.log(`Using user: ${users[0].name} (${testUserId})`);

  // 2. Suggest code
  const codeSuggestion = await rentalsService.suggestNextCode(schemaName);
  console.log(`Suggested code: ${codeSuggestion.code}`);

  // 3. Create a rental item with 3 units
  console.log('Creating rental item with 3 units...');
  const created = await rentalsService.createItem(
    schemaName,
    {
      name: 'Kandyan Bridal Saree Maroon',
      category: 'Saree',
      rentPrice: 12500,
      deposit: 10000,
      quantity: 3,
      branchId,
      size: 'Free Size',
      color: 'Maroon / Gold',
      notes: 'Heavy zardozi embroidery with matching blouse',
    },
    testUserId
  );
  console.log(`Created Rental Item ID: ${created.id}, Code: ${created.code}, Units: ${created.unitsCount}`);
  for (const u of created.units) {
    console.log(`  • Unit ${u.unitNumber}: ${u.unitCode}`);
  }

  // 4. Retrieve item and verify units
  console.log('\nFetching item details with units...');
  const item = await rentalsService.getItem(schemaName, created.id);
  console.log(`Fetched item: ${item.name} (${item.code}), Status: ${item.status}`);
  console.log(`Unit counts: total=${item.totalUnits}, available=${item.availableUnits}, cleaning=${item.cleaningUnits}`);
  console.log(`Units attached: ${item.units?.length}`);

  // 5. Add 2 more units to the item
  console.log('\nAdding 2 more units...');
  const added = await rentalsService.addUnits(
    schemaName,
    created.id,
    {
      quantity: 2,
      notes: 'Purchased additional copies',
    },
    testUserId
  );
  console.log(`Added ${added.addedCount} units:`);
  for (const u of added.units) {
    console.log(`  • Unit ${u.unitNumber}: ${u.unitCode}`);
  }

  // 6. Test unit status transitions
  const unitToUpdate = item.units![0];
  console.log(`\nTesting status update on unit ${unitToUpdate.unitCode}...`);
  const updatedUnit = await rentalsService.updateUnit(
    schemaName,
    unitToUpdate.id,
    { status: 'CLEANING', notes: 'Sent for dry cleaning' },
    testUserId
  );
  console.log(`Updated unit status to: ${updatedUnit.status}`);

  // Move to MAINTENANCE then back to AVAILABLE
  await rentalsService.updateUnit(
    schemaName,
    unitToUpdate.id,
    { status: 'MAINTENANCE', notes: 'Repairing bead work' },
    testUserId
  );
  console.log(`Moved to MAINTENANCE`);

  await rentalsService.updateUnit(
    schemaName,
    unitToUpdate.id,
    { status: 'AVAILABLE', notes: 'Ready for rent' },
    testUserId
  );
  console.log(`Returned to AVAILABLE`);

  // 7. Verify Phase 1 restriction: reject RESERVED and RENTED
  console.log('\nTesting Phase 1 restriction: attempting manual RESERVED...');
  let rejected = false;
  try {
    await rentalsService.updateUnit(
      schemaName,
      unitToUpdate.id,
      { status: 'RESERVED' as any },
      testUserId
    );
  } catch (err: any) {
    rejected = true;
    console.log(`✓ Correctly rejected: "${err.message}"`);
  }
  if (!rejected) {
    throw new Error('FAILED: Should not allow manual RESERVED in Phase 1!');
  }

  // 8. Test list with filters
  console.log('\nListing items with search filter "Kandyan"...');
  const list = await rentalsService.listItems(schemaName, { search: 'Kandyan' });
  console.log(`Found ${list.data.length} item(s) matching search.`);
  const found = list.data[0];
  console.log(`Item "${found.name}" has totalUnits=${found.totalUnits}, availableUnits=${found.availableUnits}`);

  // 9. Test deactivation and reactivation: ensure previously unavailable units stay unavailable!
  console.log('\nTesting deactivation & reactivation unit preservation...');
  // Place unit 1 in CLEANING and unit 2 in INACTIVE
  await rentalsService.updateUnit(schemaName, item.units![0].id, { status: 'CLEANING' }, testUserId);
  await rentalsService.updateUnit(schemaName, item.units![1].id, { status: 'INACTIVE' }, testUserId);

  // Deactivate master item
  await rentalsService.deactivateItem(schemaName, created.id, testUserId);
  const deactivated = await rentalsService.getItem(schemaName, created.id);
  console.log(`Item status after deactivation: ${deactivated.status}`);

  // Reactivate master item
  await rentalsService.updateItemStatus(schemaName, created.id, { status: 'ACTIVE' }, testUserId);
  const reactivated = await rentalsService.getItem(schemaName, created.id);
  console.log(`Item status after reactivation: ${reactivated.status}`);

  const reactivatedU1 = reactivated.units?.find((u) => u.id === item.units![0].id);
  const reactivatedU2 = reactivated.units?.find((u) => u.id === item.units![1].id);
  console.log(`Unit 1 status after reactivation: ${reactivatedU1?.status} (expected: CLEANING)`);
  console.log(`Unit 2 status after reactivation: ${reactivatedU2?.status} (expected: INACTIVE)`);

  if (reactivatedU1?.status !== 'CLEANING' || reactivatedU2?.status !== 'INACTIVE') {
    throw new Error('FAILED: Deactivating/reactivating item altered physical unit states!');
  }
  console.log('✓ Verified: Reactivation correctly preserved exact physical statuses of all units!');

  console.log('\n🎉 ALL BACKEND VERIFICATION TESTS PASSED!');
}

main()
  .catch((err) => {
    console.error('Test failed:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
