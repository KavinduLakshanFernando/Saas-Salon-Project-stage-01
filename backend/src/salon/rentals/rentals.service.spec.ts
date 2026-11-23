import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { RentalsService } from './rentals.service';
import { TenantSchemaService } from '../../tenant/services/tenant-schema.service';

describe('RentalsService (Phase 2)', () => {
  let service: RentalsService;
  let mockTenantSchemaService: jest.Mocked<TenantSchemaService>;
  let mockTx: any;

  const validSchema = 'tenant_test_000001';

  beforeEach(() => {
    mockTx = {
      $executeRawUnsafe: jest.fn().mockResolvedValue(undefined),
      $queryRawUnsafe: jest.fn(),
    };

    mockTenantSchemaService = {
      withTenantSchema: jest.fn().mockImplementation((_schema, cb) => cb({ tx: mockTx })),
    } as any;

    service = new RentalsService(mockTenantSchemaService);
  });

  describe('Date Validations', () => {
    it('throws BadRequestException if return date is earlier than pickup date in checkAvailability', async () => {
      await expect(
        service.checkAvailability(validSchema, {
          branchId: '00000000-0000-0000-0000-000000000001',
          pickupDate: '2026-11-12',
          returnDate: '2026-11-10',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException if return date is earlier than pickup date in createBooking', async () => {
      await expect(
        service.createBooking(
          validSchema,
          {
            branchId: '00000000-0000-0000-0000-000000000001',
            customerId: '00000000-0000-0000-0000-000000000002',
            pickupDate: '2026-11-12',
            returnDate: '2026-11-10',
            unitIds: ['00000000-0000-0000-0000-000000000003'],
          },
          'user-1',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException if duplicate units are submitted in the same booking', async () => {
      await expect(
        service.createBooking(
          validSchema,
          {
            branchId: '00000000-0000-0000-0000-000000000001',
            customerId: '00000000-0000-0000-0000-000000000002',
            pickupDate: '2026-11-10',
            returnDate: '2026-11-12',
            unitIds: [
              '00000000-0000-0000-0000-000000000003',
              '00000000-0000-0000-0000-000000000003',
            ],
          },
          'user-1',
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('Date-Based Rental Availability & Non-Overlapping Bookings', () => {
    const branchId = '00000000-0000-0000-0000-000000000001';
    const customerId = '00000000-0000-0000-0000-000000000002';
    const unitId = '00000000-0000-0000-0000-000000000003';
    const itemId = '00000000-0000-0000-0000-000000000004';

    it('allows non-overlapping dates (Nov 5-6) when existing booking is Nov 10-12', async () => {
      // 1. Branch active
      mockTx.$queryRawUnsafe.mockResolvedValueOnce([{ id: branchId, name: 'Main Branch', status: 'ACTIVE' }]);
      // 2. Item rows
      mockTx.$queryRawUnsafe.mockResolvedValueOnce([
        {
          id: itemId,
          code: 'RENT-0001',
          name: 'Bridal Saree',
          category: 'Saree',
          rentPrice: 30000,
          deposit: 0,
          status: 'ACTIVE',
        },
      ]);
      // 3. Unit rows
      mockTx.$queryRawUnsafe.mockResolvedValueOnce([
        {
          id: unitId,
          rentalItemId: itemId,
          unitNumber: 1,
          unitCode: 'RENT-0001-U01',
          status: 'AVAILABLE',
        },
      ]);
      // 4. Conflict rows: empty because Nov 5-6 does not overlap with Nov 10-12
      mockTx.$queryRawUnsafe.mockResolvedValueOnce([]);

      const result = await service.checkAvailability(validSchema, {
        branchId,
        pickupDate: '2026-11-05',
        returnDate: '2026-11-06',
      });

      expect(result).toHaveLength(1);
      expect(result[0].units[0].isAvailable).toBe(true);
      expect(result[0].availableCopiesCount).toBe(1);
    });

    it('blocks overlapping dates (Nov 11-13) when existing booking is Nov 10-12', async () => {
      // 1. Branch active
      mockTx.$queryRawUnsafe.mockResolvedValueOnce([{ id: branchId, name: 'Main Branch', status: 'ACTIVE' }]);
      // 2. Item rows
      mockTx.$queryRawUnsafe.mockResolvedValueOnce([
        {
          id: itemId,
          code: 'RENT-0001',
          name: 'Bridal Saree',
          category: 'Saree',
          rentPrice: 30000,
          deposit: 0,
          status: 'ACTIVE',
        },
      ]);
      // 3. Unit rows
      mockTx.$queryRawUnsafe.mockResolvedValueOnce([
        {
          id: unitId,
          rentalItemId: itemId,
          unitNumber: 1,
          unitCode: 'RENT-0001-U01',
          status: 'AVAILABLE',
        },
      ]);
      // 4. Conflict rows: finds existing booking
      mockTx.$queryRawUnsafe.mockResolvedValueOnce([
        {
          rentalUnitId: unitId,
          bookingReference: 'RENT-BK-0001',
          pickupDate: '2026-11-10',
          returnDate: '2026-11-12',
        },
      ]);

      const result = await service.checkAvailability(validSchema, {
        branchId,
        pickupDate: '2026-11-11',
        returnDate: '2026-11-13',
      });

      expect(result).toHaveLength(1);
      expect(result[0].units[0].isAvailable).toBe(false);
      expect(result[0].units[0].conflictReason).toContain('RENT-BK-0001');
      expect(result[0].availableCopiesCount).toBe(0);
    });

    it('marks units in CLEANING status as unavailable', async () => {
      mockTx.$queryRawUnsafe.mockResolvedValueOnce([{ id: branchId, name: 'Main Branch', status: 'ACTIVE' }]);
      mockTx.$queryRawUnsafe.mockResolvedValueOnce([
        {
          id: itemId,
          code: 'RENT-0001',
          name: 'Bridal Saree',
          category: 'Saree',
          rentPrice: 30000,
          deposit: 0,
          status: 'ACTIVE',
        },
      ]);
      mockTx.$queryRawUnsafe.mockResolvedValueOnce([
        {
          id: unitId,
          rentalItemId: itemId,
          unitNumber: 1,
          unitCode: 'RENT-0001-U01',
          status: 'CLEANING',
        },
      ]);
      mockTx.$queryRawUnsafe.mockResolvedValueOnce([]);

      const result = await service.checkAvailability(validSchema, {
        branchId,
        pickupDate: '2026-11-15',
        returnDate: '2026-11-17',
      });

      expect(result[0].units[0].isAvailable).toBe(false);
      expect(result[0].units[0].conflictReason).toContain('cleaning / laundry');
    });

    it('marks units in MAINTENANCE status as unavailable', async () => {
      mockTx.$queryRawUnsafe.mockResolvedValueOnce([{ id: branchId, name: 'Main Branch', status: 'ACTIVE' }]);
      mockTx.$queryRawUnsafe.mockResolvedValueOnce([
        {
          id: itemId,
          code: 'RENT-0001',
          name: 'Bridal Saree',
          category: 'Saree',
          rentPrice: 30000,
          deposit: 0,
          status: 'ACTIVE',
        },
      ]);
      mockTx.$queryRawUnsafe.mockResolvedValueOnce([
        {
          id: unitId,
          rentalItemId: itemId,
          unitNumber: 1,
          unitCode: 'RENT-0001-U01',
          status: 'MAINTENANCE',
        },
      ]);
      mockTx.$queryRawUnsafe.mockResolvedValueOnce([]);

      const result = await service.checkAvailability(validSchema, {
        branchId,
        pickupDate: '2026-11-15',
        returnDate: '2026-11-17',
      });

      expect(result[0].units[0].isAvailable).toBe(false);
      expect(result[0].units[0].conflictReason).toContain('maintenance');
    });

    it('createBooking allows booking when unit status is RESERVED if dates do not overlap', async () => {
      // 1. Branch active
      mockTx.$queryRawUnsafe.mockResolvedValueOnce([{ id: branchId, name: 'Main Branch', status: 'ACTIVE' }]);
      // 2. Customer active
      mockTx.$queryRawUnsafe.mockResolvedValueOnce([{ id: customerId, name: 'Customer B', phone: '0771234567', status: 'ACTIVE' }]);
      // 3. Locked units - status is RESERVED (from another non-overlapping reservation)
      mockTx.$queryRawUnsafe.mockResolvedValueOnce([
        {
          id: unitId,
          rentalItemId: itemId,
          branchId,
          unitNumber: 1,
          unitCode: 'RENT-0001-U01',
          status: 'RESERVED',
          itemName: 'Bridal Saree',
          itemCode: 'RENT-0001',
          itemStatus: 'ACTIVE',
          rentPrice: 30000,
          deposit: 0,
        },
      ]);
      // 4. Date overlap check under lock - NO overlap found
      mockTx.$queryRawUnsafe.mockResolvedValueOnce([]);
      // 5. Booking ref sequence
      mockTx.$queryRawUnsafe.mockResolvedValueOnce([{ seq: 2 }]);
      mockTx.$queryRawUnsafe.mockResolvedValueOnce([]);
      // 6. Booking insert
      mockTx.$queryRawUnsafe.mockResolvedValueOnce([{ id: 'b-new-2', createdAt: new Date() }]);
      // 7. Items insert
      mockTx.$queryRawUnsafe.mockResolvedValueOnce([]);
      // 8. Audit log
      mockTx.$queryRawUnsafe.mockResolvedValueOnce([]);

      const booking = await service.createBooking(
        validSchema,
        {
          branchId,
          customerId,
          pickupDate: '2026-11-05',
          returnDate: '2026-11-06',
          unitIds: [unitId],
        },
        'user-1',
      );

      expect(booking).toBeDefined();
      expect(booking.bookingReference).toBe('RENT-BK-0002');
      expect(booking.status).toBe('RESERVED');
    });

    it('createBooking blocks if unit is currently in CLEANING', async () => {
      mockTx.$queryRawUnsafe.mockResolvedValueOnce([{ id: branchId, name: 'Main Branch', status: 'ACTIVE' }]);
      mockTx.$queryRawUnsafe.mockResolvedValueOnce([{ id: customerId, name: 'Customer B', phone: '0771234567', status: 'ACTIVE' }]);
      mockTx.$queryRawUnsafe.mockResolvedValueOnce([
        {
          id: unitId,
          rentalItemId: itemId,
          branchId,
          unitNumber: 1,
          unitCode: 'RENT-0001-U01',
          status: 'CLEANING',
          itemName: 'Bridal Saree',
          itemCode: 'RENT-0001',
          itemStatus: 'ACTIVE',
          rentPrice: 30000,
          deposit: 0,
        },
      ]);

      await expect(
        service.createBooking(
          validSchema,
          {
            branchId,
            customerId,
            pickupDate: '2026-11-15',
            returnDate: '2026-11-16',
            unitIds: [unitId],
          },
          'user-1',
        ),
      ).rejects.toThrow(ConflictException);
    });

    it('createBooking blocks if date range overlaps with existing booking', async () => {
      mockTx.$queryRawUnsafe.mockResolvedValueOnce([{ id: branchId, name: 'Main Branch', status: 'ACTIVE' }]);
      mockTx.$queryRawUnsafe.mockResolvedValueOnce([{ id: customerId, name: 'Customer C', phone: '0771234567', status: 'ACTIVE' }]);
      mockTx.$queryRawUnsafe.mockResolvedValueOnce([
        {
          id: unitId,
          rentalItemId: itemId,
          branchId,
          unitNumber: 1,
          unitCode: 'RENT-0001-U01',
          status: 'AVAILABLE',
          itemName: 'Bridal Saree',
          itemCode: 'RENT-0001',
          itemStatus: 'ACTIVE',
          rentPrice: 30000,
          deposit: 0,
        },
      ]);
      // Conflict query returns overlapping row
      mockTx.$queryRawUnsafe.mockResolvedValueOnce([
        {
          rentalUnitId: unitId,
          unitCode: 'RENT-0001-U01',
          itemName: 'Bridal Saree',
          bookingReference: 'RENT-BK-0001',
          pickupDate: '2026-11-10',
          returnDate: '2026-11-12',
        },
      ]);

      await expect(
        service.createBooking(
          validSchema,
          {
            branchId,
            customerId,
            pickupDate: '2026-11-11',
            returnDate: '2026-11-13',
            unitIds: [unitId],
          },
          'user-1',
        ),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('Cancellation Validations', () => {
    it('throws NotFoundException if booking does not exist', async () => {
      mockTx.$queryRawUnsafe.mockResolvedValueOnce([]); // existing booking lookup

      await expect(
        service.cancelBooking(validSchema, '00000000-0000-0000-0000-000000000001', {}, 'user-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException if booking is already CANCELLED', async () => {
      mockTx.$queryRawUnsafe.mockResolvedValueOnce([
        {
          id: 'b-1',
          booking_reference: 'RENT-BK-0001',
          status: 'CANCELLED',
          customer_id: 'c-1',
        },
      ]);

      await expect(
        service.cancelBooking(validSchema, '00000000-0000-0000-0000-000000000001', {}, 'user-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException if booking status is not RESERVED (e.g. PICKED_UP)', async () => {
      mockTx.$queryRawUnsafe.mockResolvedValueOnce([
        {
          id: 'b-1',
          booking_reference: 'RENT-BK-0001',
          status: 'PICKED_UP',
          customer_id: 'c-1',
        },
      ]);

      await expect(
        service.cancelBooking(validSchema, '00000000-0000-0000-0000-000000000001', {}, 'user-1'),
      ).rejects.toThrow(BadRequestException);
    });
  });
  describe('Phase 3: Rental Payments (Part A)', () => {
    const bookingId = '00000000-0000-0000-0000-000000000010';

    it('returns existing payment if idempotency key was already processed (retry prevention)', async () => {
      // 1. Existing idempotency lookup returns existing payment id
      mockTx.$queryRawUnsafe.mockResolvedValueOnce([{ id: 'p-existing-1' }]);
      // 2. getPayment call finds the payment
      const mockExistingPayment = {
        id: 'p-existing-1',
        paymentNumber: 'RPAY-0001',
        amount: 5000,
        bookingId,
      };
      jest.spyOn(service, 'getPayment').mockResolvedValueOnce(mockExistingPayment as any);

      const result = await service.collectPayment(
        validSchema,
        {
          bookingId,
          amount: 5000,
          paymentMethod: 'CASH',
          idempotencyKey: 'idemp-12345',
        },
        'user-1',
      );

      expect(result).toBe(mockExistingPayment);
      expect(service.getPayment).toHaveBeenCalledWith(validSchema, 'p-existing-1');
    });

    it('throws BadRequestException if payment amount is zero or negative', async () => {
      await expect(
        service.collectPayment(
          validSchema,
          {
            bookingId,
            amount: 0,
            paymentMethod: 'CASH',
          },
          'user-1',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws NotFoundException if booking does not exist', async () => {
      mockTx.$queryRawUnsafe.mockResolvedValueOnce([]); // booking lookup returns empty

      await expect(
        service.collectPayment(
          validSchema,
          {
            bookingId,
            amount: 5000,
            paymentMethod: 'CASH',
          },
          'user-1',
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException if booking is CANCELLED', async () => {
      mockTx.$queryRawUnsafe.mockResolvedValueOnce([
        {
          id: bookingId,
          branchId: 'br-1',
          branchName: 'Main',
          customerId: 'c-1',
          customerName: 'Nethmi',
          status: 'CANCELLED',
          totalRent: 10000,
          totalDeposit: 5000,
        },
      ]);

      await expect(
        service.collectPayment(
          validSchema,
          {
            bookingId,
            amount: 5000,
            paymentMethod: 'CASH',
          },
          'user-1',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException if booking is RETURNED and already SETTLED', async () => {
      mockTx.$queryRawUnsafe.mockResolvedValueOnce([
        {
          id: bookingId,
          branchId: 'br-1',
          branchName: 'Main',
          customerId: 'c-1',
          customerName: 'Nethmi',
          status: 'RETURNED',
          settlementStatus: 'SETTLED',
          totalRent: 10000,
          totalDeposit: 5000,
        },
      ]);

      await expect(
        service.collectPayment(
          validSchema,
          {
            bookingId,
            amount: 5000,
            paymentMethod: 'CASH',
          },
          'user-1',
        ),
      ).rejects.toThrow('Cannot collect payment for a booking that has already been returned and settled');
    });

    it('allows collecting payment for a RETURNED booking when settlementStatus is UNSETTLED (Pay on Return)', async () => {
      // 1. Booking lookup returns RETURNED but UNSETTLED
      mockTx.$queryRawUnsafe.mockResolvedValueOnce([
        {
          id: bookingId,
          branchId: 'br-1',
          branchName: 'Main',
          customerId: 'c-1',
          customerName: 'Nethmi',
          bookingReference: 'RENT-BK-0003',
          status: 'RETURNED',
          settlementStatus: 'UNSETTLED',
          totalRent: 30000,
          totalDeposit: 0,
        },
      ]);
      // 2. Existing allocations: 10000 advance rent
      mockTx.$queryRawUnsafe.mockResolvedValueOnce([
        { allocationType: 'RENT', totalAmount: 10000 },
      ]);
      // 3. Next payment code sequence
      mockTx.$queryRawUnsafe.mockResolvedValueOnce([{ seq: '2' }]);
      // 4. Code uniqueness check
      mockTx.$queryRawUnsafe.mockResolvedValueOnce([]);
      // 5. Payment insert
      mockTx.$queryRawUnsafe.mockResolvedValueOnce([
        { id: 'pay-ret-1', createdAt: new Date(), updatedAt: new Date() },
      ]);
      // 5. Allocation insert
      mockTx.$queryRawUnsafe.mockResolvedValueOnce([
        { id: 'alloc-ret-1', createdAt: new Date() },
      ]);
      // 6. Audit log
      mockTx.$queryRawUnsafe.mockResolvedValueOnce([]);

      const payment = await service.collectPayment(
        validSchema,
        {
          bookingId,
          amount: 20000,
          rentAmount: 20000,
          paymentMethod: 'CASH',
          notes: 'Pay on Return balance',
        },
        'user-1',
      );

      expect(payment).toBeDefined();
      expect(payment.amount).toBe(20000);
      expect(payment.rentAmount).toBe(20000);
    });

    it('throws BadRequestException if rent allocation exceeds remaining rental balance', async () => {
      // 1. Booking row: totalRent = 10000, totalDeposit = 5000
      mockTx.$queryRawUnsafe.mockResolvedValueOnce([
        {
          id: bookingId,
          branchId: 'br-1',
          branchName: 'Main',
          customerId: 'c-1',
          customerName: 'Nethmi',
          status: 'RESERVED',
          totalRent: 10000,
          totalDeposit: 5000,
        },
      ]);
      // 2. Existing allocations: 8000 already paid for RENT
      mockTx.$queryRawUnsafe.mockResolvedValueOnce([
        { allocationType: 'RENT', totalAmount: 8000 },
      ]);

      // Attempting to pay 3000 rent (remaining is only 2000)
      await expect(
        service.collectPayment(
          validSchema,
          {
            bookingId,
            amount: 3000,
            rentAmount: 3000,
            depositAmount: 0,
            paymentMethod: 'CASH',
          },
          'user-1',
        ),
      ).rejects.toThrow(/exceeds the remaining rental balance/);
    });

    it('throws BadRequestException if deposit allocation exceeds remaining required deposit', async () => {
      // 1. Booking row
      mockTx.$queryRawUnsafe.mockResolvedValueOnce([
        {
          id: bookingId,
          branchId: 'br-1',
          branchName: 'Main',
          customerId: 'c-1',
          customerName: 'Nethmi',
          status: 'RESERVED',
          totalRent: 10000,
          totalDeposit: 5000,
        },
      ]);
      // 2. Existing allocations: 4000 already held for DEPOSIT
      mockTx.$queryRawUnsafe.mockResolvedValueOnce([
        { allocationType: 'SECURITY_DEPOSIT', totalAmount: 4000 },
      ]);

      // Attempting to pay 2000 deposit (remaining required is only 1000)
      await expect(
        service.collectPayment(
          validSchema,
          {
            bookingId,
            amount: 2000,
            rentAmount: 0,
            depositAmount: 2000,
            paymentMethod: 'CARD',
          },
          'user-1',
        ),
      ).rejects.toThrow(/exceeds the remaining required deposit/);
    });

    it('throws BadRequestException if allocations sum does not equal total amount', async () => {
      // 1. Booking row
      mockTx.$queryRawUnsafe.mockResolvedValueOnce([
        {
          id: bookingId,
          branchId: 'br-1',
          branchName: 'Main',
          customerId: 'c-1',
          customerName: 'Nethmi',
          status: 'RESERVED',
          totalRent: 10000,
          totalDeposit: 5000,
        },
      ]);
      // 2. Existing allocations: empty
      mockTx.$queryRawUnsafe.mockResolvedValueOnce([]);

      await expect(
        service.collectPayment(
          validSchema,
          {
            bookingId,
            amount: 5000,
            rentAmount: 2000,
            depositAmount: 2000, // 2000 + 2000 = 4000 !== 5000
            paymentMethod: 'CASH',
          },
          'user-1',
        ),
      ).rejects.toThrow(/must exactly equal the sum/);
    });

    it('successfully collects payment allocating both rent and security deposit', async () => {
      // 1. Booking row
      mockTx.$queryRawUnsafe.mockResolvedValueOnce([
        {
          id: bookingId,
          branchId: 'br-1',
          branchName: 'Main Branch',
          customerId: 'c-1',
          customerName: 'Nethmi Perera',
          customerPhone: '0771234567',
          bookingReference: 'RENT-BK-0001',
          status: 'RESERVED',
          totalRent: 10000,
          totalDeposit: 5000,
        },
      ]);
      // 2. Existing allocations: 0
      mockTx.$queryRawUnsafe.mockResolvedValueOnce([]);
      // 3. Next payment code sequence
      mockTx.$queryRawUnsafe.mockResolvedValueOnce([{ seq: '1' }]);
      // 4. Code uniqueness check
      mockTx.$queryRawUnsafe.mockResolvedValueOnce([]);
      // 5. Payment insert
      mockTx.$queryRawUnsafe.mockResolvedValueOnce([
        { id: 'pay-1', createdAt: new Date(), updatedAt: new Date() },
      ]);
      // 6. Rent allocation insert
      mockTx.$queryRawUnsafe.mockResolvedValueOnce([
        { id: 'alloc-1', createdAt: new Date() },
      ]);
      // 7. Deposit allocation insert
      mockTx.$queryRawUnsafe.mockResolvedValueOnce([
        { id: 'alloc-2', createdAt: new Date() },
      ]);

      const payment = await service.collectPayment(
        validSchema,
        {
          bookingId,
          amount: 8000,
          rentAmount: 5000,
          depositAmount: 3000,
          paymentMethod: 'CASH',
          notes: 'Advance rental + partial deposit',
        },
        'user-1',
      );

      expect(payment.id).toBe('pay-1');
      expect(payment.paymentNumber).toBe('RPAY-0001');
      expect(payment.amount).toBe(8000);
      expect(payment.rentAmount).toBe(5000);
      expect(payment.depositAmount).toBe(3000);
      expect(payment.allocations).toHaveLength(2);
      expect(payment.allocations![0].allocationType).toBe('RENT');
      expect(payment.allocations![1].allocationType).toBe('SECURITY_DEPOSIT');
    });
  });

  describe('Phase 3: Pickup & Handover (Part B)', () => {
    const bookingId = '00000000-0000-0000-0000-000000000020';

    it('throws NotFoundException if booking does not exist', async () => {
      mockTx.$queryRawUnsafe.mockResolvedValueOnce([]); // empty booking lookup

      await expect(
        service.confirmPickup(validSchema, bookingId, {}, 'user-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws ConflictException if booking is already PICKED_UP (prevents duplicate pickup)', async () => {
      mockTx.$queryRawUnsafe.mockResolvedValueOnce([
        {
          id: bookingId,
          bookingReference: 'RENT-BK-0002',
          status: 'PICKED_UP',
          actualPickupAt: new Date(),
        },
      ]);

      await expect(
        service.confirmPickup(validSchema, bookingId, {}, 'user-1'),
      ).rejects.toThrow(ConflictException);
    });

    it('throws BadRequestException if booking status is not RESERVED (e.g. CANCELLED)', async () => {
      mockTx.$queryRawUnsafe.mockResolvedValueOnce([
        {
          id: bookingId,
          bookingReference: 'RENT-BK-0002',
          status: 'CANCELLED',
        },
      ]);

      await expect(
        service.confirmPickup(validSchema, bookingId, {}, 'user-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException if actual pickup date is later than scheduled return date', async () => {
      mockTx.$queryRawUnsafe.mockResolvedValueOnce([
        {
          id: bookingId,
          bookingReference: 'RENT-BK-0002',
          status: 'RESERVED',
          pickupDate: '2026-11-01',
          returnDate: '2026-11-05',
          totalRent: 5000,
          totalDeposit: 2000,
        },
      ]);

      await expect(
        service.confirmPickup(
          validSchema,
          bookingId,
          { actualPickupDate: '2026-11-06' }, // after returnDate
          'user-1',
        ),
      ).rejects.toThrow(/cannot be later than the scheduled return date/);
    });

    it('throws BadRequestException if security deposit has not been fully collected', async () => {
      // 1. Booking row: totalRent = 5000, totalDeposit = 2000
      mockTx.$queryRawUnsafe.mockResolvedValueOnce([
        {
          id: bookingId,
          bookingReference: 'RENT-BK-0002',
          status: 'RESERVED',
          pickupDate: '2026-11-01',
          returnDate: '2026-11-05',
          totalRent: 5000,
          totalDeposit: 2000,
        },
      ]);
      // 2. Existing allocations: 5000 paid for rent, but only 1000 collected for deposit (1000 missing)
      mockTx.$queryRawUnsafe.mockResolvedValueOnce([
        { allocationType: 'RENT', totalAmount: 5000 },
        { allocationType: 'SECURITY_DEPOSIT', totalAmount: 1000 },
      ]);

      await expect(
        service.confirmPickup(validSchema, bookingId, {}, 'user-1'),
      ).rejects.toThrow(/security deposit has not been fully collected/);
    });

    it('allows pickup with partial advance payment (Scenario 1)', async () => {
      // 1. Booking row: totalRent = 5000, totalDeposit = 2000
      mockTx.$queryRawUnsafe.mockResolvedValueOnce([
        {
          id: bookingId,
          bookingReference: 'RENT-BK-0002',
          status: 'RESERVED',
          pickupDate: '2026-11-01',
          returnDate: '2026-11-05',
          totalRent: 5000,
          totalDeposit: 2000,
        },
      ]);
      // 2. Existing allocations: 2000 full deposit held, but only 3000 paid for rent (2000 remaining balance)
      mockTx.$queryRawUnsafe.mockResolvedValueOnce([
        { allocationType: 'RENT', totalAmount: 3000 },
        { allocationType: 'SECURITY_DEPOSIT', totalAmount: 2000 },
      ]);
      // 3. Booking items
      mockTx.$queryRawUnsafe.mockResolvedValueOnce([
        { id: 'bi-1', rentalUnitId: 'u-1' },
      ]);
      // 4. Locked units query returns available unit
      mockTx.$queryRawUnsafe.mockResolvedValueOnce([
        { id: 'u-1', unitCode: 'RENT-0001-01', status: 'AVAILABLE' },
      ]);
      // 5. Update unit status
      mockTx.$executeRawUnsafe.mockResolvedValueOnce(1);
      // 6. Update booking status to PICKED_UP
      mockTx.$executeRawUnsafe.mockResolvedValueOnce(1);

      jest.spyOn(service, 'getBooking').mockResolvedValueOnce({
        id: bookingId,
        bookingReference: 'RENT-BK-0002',
        status: 'PICKED_UP',
      } as any);

      const result = await service.confirmPickup(validSchema, bookingId, {}, 'user-1');
      expect(result.status).toBe('PICKED_UP');
    });

    it('throws ConflictException if any physical unit is already RENTED', async () => {
      // 1. Booking row
      mockTx.$queryRawUnsafe.mockResolvedValueOnce([
        {
          id: bookingId,
          bookingReference: 'RENT-BK-0002',
          status: 'RESERVED',
          pickupDate: '2026-11-01',
          returnDate: '2026-11-05',
          totalRent: 5000,
          totalDeposit: 2000,
        },
      ]);
      // 2. Allocations: full rent and full deposit cleared
      mockTx.$queryRawUnsafe.mockResolvedValueOnce([
        { allocationType: 'RENT', totalAmount: 5000 },
        { allocationType: 'SECURITY_DEPOSIT', totalAmount: 2000 },
      ]);
      // 3. Booking items
      mockTx.$queryRawUnsafe.mockResolvedValueOnce([
        { id: 'bi-1', rentalUnitId: 'u-1' },
      ]);
      // 4. Locked units query returns unit in RENTED status
      mockTx.$queryRawUnsafe.mockResolvedValueOnce([
        { id: 'u-1', unitCode: 'RENT-0001-01', status: 'RENTED' },
      ]);

      await expect(
        service.confirmPickup(validSchema, bookingId, {}, 'user-1'),
      ).rejects.toThrow(/already marked as RENTED/);
    });

    it('successfully confirms pickup, updates booking to PICKED_UP, units to RENTED, and logs audit', async () => {
      // 1. Booking row
      mockTx.$queryRawUnsafe.mockResolvedValueOnce([
        {
          id: bookingId,
          bookingReference: 'RENT-BK-0002',
          status: 'RESERVED',
          pickupDate: '2026-11-01',
          returnDate: '2026-11-05',
          totalRent: 5000,
          totalDeposit: 2000,
        },
      ]);
      // 2. Allocations: fully paid
      mockTx.$queryRawUnsafe.mockResolvedValueOnce([
        { allocationType: 'RENT', totalAmount: 5000 },
        { allocationType: 'SECURITY_DEPOSIT', totalAmount: 2000 },
      ]);
      // 3. Booking items
      mockTx.$queryRawUnsafe.mockResolvedValueOnce([
        { id: 'bi-1', rentalUnitId: 'u-1' },
      ]);
      // 4. Locked units: AVAILABLE
      mockTx.$queryRawUnsafe.mockResolvedValueOnce([
        { id: 'u-1', unitCode: 'RENT-0001-01', status: 'AVAILABLE' },
      ]);

      // Mock getBooking return
      const updatedBooking = {
        id: bookingId,
        bookingReference: 'RENT-BK-0002',
        status: 'PICKED_UP',
      };
      jest.spyOn(service, 'getBooking').mockResolvedValueOnce(updatedBooking as any);

      const result = await service.confirmPickup(
        validSchema,
        bookingId,
        {
          actualPickupDate: '2026-11-01',
          pickupNotes: 'Handed over in pristine condition',
        },
        'user-1',
      );

      expect(result).toBe(updatedBooking);
      // Verify updates executed
      expect(mockTx.$executeRawUnsafe).toHaveBeenCalledWith(
        expect.stringContaining("status = 'PICKED_UP'"),
        'user-1',
        'Handed over in pristine condition',
        bookingId,
      );
      expect(mockTx.$executeRawUnsafe).toHaveBeenCalledWith(
        expect.stringContaining("status = 'RENTED'"),
        ['u-1'],
      );
    });
  });

  describe('WhatsApp Rental Catalog Sharing', () => {
    let mockPrisma: any;
    let mockConfigService: any;
    let catalogService: RentalsService;

    beforeEach(() => {
      mockPrisma = {
        rentalCatalogShare: {
          create: jest.fn(),
          count: jest.fn(),
          findMany: jest.fn(),
          findFirst: jest.fn(),
          findUnique: jest.fn(),
          update: jest.fn(),
        },
        tenant: {
          findUnique: jest.fn(),
        },
        tenantFeature: {
          findFirst: jest.fn(),
        },
      };

      mockConfigService = {
        get: jest.fn().mockImplementation((key: string) => {
          if (key === 'FRONTEND_URL') return 'https://salon.example.com';
          return null;
        }),
      };

      catalogService = new RentalsService(mockTenantSchemaService, mockPrisma, mockConfigService);
    });

    it('previewCatalogItems returns active rental items', async () => {
      mockTx.$queryRawUnsafe.mockResolvedValueOnce([
        {
          id: 'item-1',
          code: 'RENT-001',
          name: 'Bridal Saree',
          category: 'Saree',
          rentPrice: 25000,
          deposit: 10000,
          imageUrl: 'img1.png',
          notes: 'Red silk',
        },
      ]);

      const result = await catalogService.previewCatalogItems(validSchema, {
        selectionType: 'ALL',
      });

      expect(result.total).toBe(1);
      expect(result.items[0].code).toBe('RENT-001');
      expect(mockTx.$queryRawUnsafe).toHaveBeenCalledWith(
        expect.stringContaining("ri.status = 'ACTIVE'"),
      );
    });

    it('createCatalogShare throws BadRequestException if SELECTED_ITEMS has empty selectedItemIds', async () => {
      await expect(
        catalogService.createCatalogShare('tenant-1', validSchema, {
          title: 'Special Collection',
          selectionType: 'SELECTED_ITEMS',
          selectedItemIds: [],
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('createCatalogShare successfully creates a share with shareUrl', async () => {
      mockPrisma.tenant.findUnique.mockResolvedValueOnce({
        phone: '0771122334',
        email: 'info@salon.lk',
      });

      mockPrisma.rentalCatalogShare.create.mockImplementation((args: any) =>
        Promise.resolve({
          id: 'share-1',
          ...args.data,
          createdAt: new Date(),
        }),
      );

      const result = await catalogService.createCatalogShare(
        'tenant-1',
        validSchema,
        {
          title: 'Wedding Season 2026',
          selectionType: 'ALL',
          showPrices: true,
        },
        'user-1',
        'Kavindu Staff',
      );

      expect(result.title).toBe('Wedding Season 2026');
      expect(result.shareToken).toBeDefined();
      expect(result.shareUrl).toContain('https://salon.example.com/rentals/catalog/');
      expect(result.contactPhone).toBe('0771122334');
      expect(mockPrisma.rentalCatalogShare.create).toHaveBeenCalled();
    });

    it('revokeCatalogShare marks share as revoked', async () => {
      mockPrisma.rentalCatalogShare.findFirst.mockResolvedValueOnce({
        id: 'share-1',
        tenantId: 'tenant-1',
        revokedAt: null,
      });

      mockPrisma.rentalCatalogShare.update.mockResolvedValueOnce({
        id: 'share-1',
        shareToken: 'token123',
        revokedAt: new Date(),
      });

      const result = await catalogService.revokeCatalogShare('tenant-1', 'share-1', 'user-1');
      expect(result.share.status).toBe('REVOKED');
      expect(result.share.shareUrl).toContain('token123');
    });

    it('getPublicCatalog throws NotFoundException if token does not exist', async () => {
      mockPrisma.rentalCatalogShare.findUnique.mockResolvedValueOnce(null);

      await expect(catalogService.getPublicCatalog('invalid-token')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('getPublicCatalog returns REVOKED status when link was revoked', async () => {
      mockPrisma.rentalCatalogShare.findUnique.mockResolvedValueOnce({
        id: 'share-1',
        shareToken: 'revoked-token',
        revokedAt: new Date(),
        tenant: { name: 'Salon Heart', logoUrl: null, primaryColor: null },
      });

      const result = await catalogService.getPublicCatalog('revoked-token');
      expect(result.status).toBe('REVOKED');
    });

    it('getPublicCatalog returns sanitized active items with hidden prices when showPrices is false', async () => {
      mockPrisma.rentalCatalogShare.findUnique.mockResolvedValueOnce({
        id: 'share-1',
        shareToken: 'valid-token',
        tenantId: 'tenant-1',
        schemaName: validSchema,
        title: 'Exclusive Jewellery',
        selectionType: 'ALL',
        showPrices: false,
        expiresAt: new Date(Date.now() + 86400000),
        revokedAt: null,
        tenant: {
          id: 'tenant-1',
          name: 'Salon Heart',
          logoUrl: 'https://img.com/logo.png',
          phone: '0771122334',
          email: 'heart@salon.lk',
          status: 'ACTIVE',
          primaryColor: '#7C3AED',
        },
      });

      mockPrisma.tenantFeature.findFirst.mockResolvedValueOnce({
        isEnabled: true,
      });

      mockTx.$queryRawUnsafe.mockResolvedValueOnce([
        {
          id: 'item-1',
          code: 'RENT-002',
          name: 'Diamond Necklace',
          category: 'Jewellery',
          size: null,
          color: 'Silver',
          rentPrice: null,
          notes: 'High sparkle',
          imageUrl: 'neck.png',
        },
      ]);

      const result: any = await catalogService.getPublicCatalog('valid-token');
      expect(result.status).toBe('ACTIVE');
      expect(result.catalog.showPrices).toBe(false);
      expect(result.salon.name).toBe('Salon Heart');
      expect(result.items.length).toBe(1);
      expect(result.items[0].rentPrice).toBeNull();
      expect(result.categories).toEqual(['Jewellery']);
    });
  });

});
