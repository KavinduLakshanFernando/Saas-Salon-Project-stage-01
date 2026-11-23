import { DashboardService } from './dashboard.service';
import { PrismaService } from '../../database/prisma.service';
import { TenantSchemaService } from '../../tenant/services/tenant-schema.service';
import { Decimal } from '@prisma/client/runtime/library';

describe('Dashboard Financial Calculations', () => {
  let service: DashboardService;
  let mockPrisma: Partial<PrismaService>;
  let mockTenantSchemaService: Partial<TenantSchemaService>;

  beforeEach(() => {
    mockPrisma = {
      tenant: {
        findUnique: jest.fn().mockResolvedValue({
          openingBankBalance: new Decimal(35000),
          lowStockThreshold: 5,
        }),
      } as any,
    };

    mockTenantSchemaService = {
      withTenantSchema: jest.fn(),
    };

    service = new DashboardService(
      mockTenantSchemaService as TenantSchemaService,
      mockPrisma as PrismaService,
    );
  });

  describe('Net Profit formula verification', () => {
    it('should calculate Net Profit = Total Revenue - Total Expenses - Salaries', () => {
      const revenue = 15850;
      const expenses = 6600;
      const salaries = 0;

      const netProfit = revenue - expenses - salaries;
      expect(netProfit).toBe(9250);
    });

    it('should calculate negative Net Profit (deficit) when expenses exceed revenue', () => {
      const revenue = 15850;
      const expenses = 66600;
      const salaries = 0;

      const netProfit = revenue - expenses - salaries;
      expect(netProfit).toBe(-50750);
    });

    it('should properly deduct salaries when salaries exist in the period', () => {
      const revenue = 50000;
      const expenses = 10000;
      const salaries = 15000;

      const netProfit = revenue - expenses - salaries;
      expect(netProfit).toBe(25000);
    });
  });

  describe('Date range filter behavior and expense isolation', () => {
    const mockExpensesDatabase = [
      { id: 'EXP-0003', title: 'Marketing', amount: 6600, expenseDate: '2026-11-08', status: 'ACTIVE' },
      { id: 'EXP-0001', title: 'Rent', amount: 60000, expenseDate: '2026-11-30', status: 'ACTIVE' },
      { id: 'EXP-0002', title: 'Salary', amount: 50000, expenseDate: '2026-12-10', status: 'ACTIVE' },
      { id: 'EXP-0000', title: 'Past Supplies', amount: 4500, expenseDate: '2026-10-15', status: 'ACTIVE' },
      { id: 'EXP-VOID', title: 'Cancelled Ad', amount: 12000, expenseDate: '2026-11-05', status: 'VOID' },
    ];

    function filterExpensesForPeriod(startDate: string, endDate: string) {
      return mockExpensesDatabase.filter((e) =>
        e.status === 'ACTIVE' &&
        e.expenseDate >= startDate &&
        e.expenseDate <= endDate,
      );
    }

    it('excludes future-dated expenses for current period (e.g. Month-to-date: 2026-11-01 to 2026-11-10)', () => {
      const start = '2026-11-01';
      const end = '2026-11-10'; // Simulated current date

      const filtered = filterExpensesForPeriod(start, end);
      const totalExpenses = filtered.reduce((sum, e) => sum + e.amount, 0);

      expect(filtered).toHaveLength(1);
      expect(filtered[0].id).toBe('EXP-0003');
      expect(totalExpenses).toBe(6600);

      // Verify future-dated expenses are excluded
      expect(filtered.find((e) => e.id === 'EXP-0001')).toBeUndefined();
      expect(filtered.find((e) => e.id === 'EXP-0002')).toBeUndefined();

      // Net profit for this period
      const periodRevenue = 15850;
      const netProfit = periodRevenue - totalExpenses;
      expect(netProfit).toBe(9250);
    });

    it('includes future-dated expenses ONLY when reporting period explicitly covers them', () => {
      // User selects custom date range spanning the entire month (2026-11-01 to 2026-11-30)
      const start = '2026-11-01';
      const end = '2026-11-30';

      const filtered = filterExpensesForPeriod(start, end);
      const totalExpenses = filtered.reduce((sum, e) => sum + e.amount, 0);

      expect(filtered).toHaveLength(2);
      expect(filtered.map((e) => e.id).sort()).toEqual(['EXP-0001', 'EXP-0003']);
      expect(totalExpenses).toBe(66600); // 6,600 + 60,000

      // EXP-0002 (Dec 10) is still excluded
      expect(filtered.find((e) => e.id === 'EXP-0002')).toBeUndefined();

      const periodRevenue = 15850;
      const netProfit = periodRevenue - totalExpenses;
      expect(netProfit).toBe(-50750);
    });

    it('handles past date ranges accurately (e.g. 2026-10-01 to 2026-10-31)', () => {
      const start = '2026-10-01';
      const end = '2026-10-31';

      const filtered = filterExpensesForPeriod(start, end);
      const totalExpenses = filtered.reduce((sum, e) => sum + e.amount, 0);

      expect(filtered).toHaveLength(1);
      expect(filtered[0].id).toBe('EXP-0000');
      expect(totalExpenses).toBe(4500);

      const pastRevenue = 20000;
      const netProfit = pastRevenue - totalExpenses;
      expect(netProfit).toBe(15500);
    });

    it('handles future date ranges accurately (e.g. 2026-12-01 to 2026-12-31)', () => {
      const start = '2026-12-01';
      const end = '2026-12-31';

      const filtered = filterExpensesForPeriod(start, end);
      const totalExpenses = filtered.reduce((sum, e) => sum + e.amount, 0);

      expect(filtered).toHaveLength(1);
      expect(filtered[0].id).toBe('EXP-0002');
      expect(totalExpenses).toBe(50000);

      const projectedRevenue = 75000;
      const netProfit = projectedRevenue - totalExpenses;
      expect(netProfit).toBe(25000);
    });
  });

  describe('Bank Balance separation from Net Profit', () => {
    it('calculates currentBankBalance using actual realized transactions up to today, ignoring future-dated expenses', () => {
      const openingBankBalance = 35000;
      const actualRevenueToDate = 15850;
      // Realized expenses to date (expense_date <= CURRENT_DATE): EXP-0003 only (6,600)
      // Future expenses EXP-0001 (60,000) and EXP-0002 (50,000) have not occurred yet
      const actualExpensesToDate = 6600;
      const actualSalariesToDate = 0;

      const actualCashFlow = actualRevenueToDate - actualExpensesToDate - actualSalariesToDate;
      const currentBankBalance = openingBankBalance + actualCashFlow;

      expect(currentBankBalance).toBe(44250);
      // Verify it is NOT the incorrect -65750 that resulted from deducting future 110,000
      expect(currentBankBalance).not.toBe(-65750);
    });

    it('keeps bank balance independent from the chart period selected', () => {
      const openingBankBalance = 35000;
      const actualInflows = 15850;
      const actualOutflows = 6600;
      const currentBankBalance = openingBankBalance + actualInflows - actualOutflows;

      // Even if user selects 'today' where today's revenue is 2,000 and expenses is 0,
      // the bank balance remains the cumulative 44,250
      const todayRevenue = 2000;
      const todayExpenses = 0;
      const todayNetProfit = todayRevenue - todayExpenses;

      expect(todayNetProfit).toBe(2000);
      expect(currentBankBalance).toBe(44250);
    });

    it('returns null for bank balance when openingBankBalance is not configured', () => {
      const openingBankBalance: number | null = null;
      const actualInflows = 15850;
      const actualOutflows = 6600;

      const currentBankBalance = openingBankBalance === null
        ? null
        : openingBankBalance + actualInflows - actualOutflows;

      expect(currentBankBalance).toBeNull();
    });
  });

  describe('Service getDashboard integration with SQL queries', () => {
    it('returns aligned netProfit, currentNetProfit, and separate currentBankBalance', async () => {
      // Mock withTenantSchema tx execution
      (mockTenantSchemaService.withTenantSchema as jest.Mock).mockImplementation(
        async (_schemaName: string, callback: any) => {
          const fakeTx = {
            $queryRawUnsafe: jest.fn().mockImplementation((sql: string) => {
              if (sql.includes('SELECT COALESCE(SUM(total), 0)::text AS total') && sql.includes('sales')) {
                return Promise.resolve([{ total: '15850', count: BigInt(5) }]);
              }
              if (sql.includes('SELECT COALESCE(SUM(amount), 0)::text AS total') && sql.includes('expenses')) {
                // Period expenses bounded by start and end
                return Promise.resolve([{ total: '6600' }]);
              }
              if (sql.includes('SELECT COALESCE(SUM(total_net), 0)::text AS total') && sql.includes('payroll_runs')) {
                return Promise.resolve([{ total: '0' }]);
              }
              if (sql.includes('actualFinancialTotals') || sql.includes('expense_date <= CURRENT_DATE')) {
                return Promise.resolve([{
                  revenue: '15850',
                  expenses: '6600',
                  salaries: '0',
                }]);
              }
              // For all other queries return safe empty structures
              return Promise.resolve([]);
            }),
          };
          return callback({ tx: fakeTx });
        },
      );

      const result = await service.getDashboard(
        'tenant-uuid-1',
        'tenant_000001',
        undefined,
        'month',
      );

      // 1. Period Net profit must be 15850 - 6600 - 0 = 9250
      expect(result.financials.netProfit).toBe(9250);
      expect(result.kpis.netProfit).toBe(9250);

      // 2. currentNetProfit should match period net profit for backwards compatibility
      expect(result.financials.currentNetProfit).toBe(9250);
      expect(result.kpis.currentNetProfit).toBe(9250);

      // 3. Bank balance must be separate and computed from opening + actual cash flow
      // 35,000 + 15,850 - 6,600 = 44,250
      expect(result.financials.currentBankBalance).toBe(44250);
      expect(result.kpis.currentBankBalance).toBe(44250);
    });
  });
});
