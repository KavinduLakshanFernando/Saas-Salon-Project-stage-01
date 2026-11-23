import { generateSequentialCode } from './code-generator.util';

describe('generateSequentialCode', () => {
  it('generates 0001 when table is empty (max_num is null)', async () => {
    const mockTx = {
      $queryRawUnsafe: jest.fn().mockImplementation((query: string) => {
        if (query.includes('MAX(')) {
          return Promise.resolve([{ max_num: null }]);
        }
        if (query.includes('LIMIT 1')) {
          return Promise.resolve([]);
        }
        return Promise.resolve([]);
      }),
    };

    const code = await generateSequentialCode(mockTx, '"tenant_001"."services"', 'SRV-');
    expect(code).toBe('SRV-0001');
    expect(mockTx.$queryRawUnsafe).toHaveBeenCalledWith(
      expect.stringContaining('SELECT MAX('),
      'SRV-',
    );
  });

  it('generates next code after max existing number even when earlier records were deleted', async () => {
    // Simulates scenario where records 1..17 were created, 4 was deleted, so count=16, but max is 17
    const mockTx = {
      $queryRawUnsafe: jest.fn().mockImplementation((query: string) => {
        if (query.includes('MAX(')) {
          return Promise.resolve([{ max_num: 17 }]);
        }
        if (query.includes('LIMIT 1')) {
          return Promise.resolve([]); // SRV-0018 is free
        }
        return Promise.resolve([]);
      }),
    };

    const code = await generateSequentialCode(mockTx, '"tenant_001"."services"', 'SRV-');
    expect(code).toBe('SRV-0018');
  });

  it('increments through collision loop if candidate code already exists', async () => {
    let callCount = 0;
    const mockTx = {
      $queryRawUnsafe: jest.fn().mockImplementation((query: string, candidate?: string) => {
        if (query.includes('MAX(')) {
          return Promise.resolve([{ max_num: 10 }]);
        }
        if (query.includes('LIMIT 1')) {
          callCount++;
          // Simulate SRV-0011 already existing, SRV-0012 free
          if (candidate === 'SRV-0011') {
            return Promise.resolve([{ exists: 1 }]);
          }
          return Promise.resolve([]);
        }
        return Promise.resolve([]);
      }),
    };

    const code = await generateSequentialCode(mockTx, '"tenant_001"."services"', 'SRV-');
    expect(code).toBe('SRV-0012');
    expect(callCount).toBe(2);
  });

  it('targets reference_no for stock_receipts / SIN- prefix', async () => {
    const mockTx = {
      $queryRawUnsafe: jest.fn().mockImplementation((query: string) => {
        if (query.includes('MAX(')) {
          expect(query).toContain('"reference_no"');
          return Promise.resolve([{ max_num: 5 }]);
        }
        if (query.includes('LIMIT 1')) {
          expect(query).toContain('"reference_no"');
          return Promise.resolve([]);
        }
        return Promise.resolve([]);
      }),
    };

    const code = await generateSequentialCode(mockTx, '"tenant_001"."stock_receipts"', 'SIN-');
    expect(code).toBe('SIN-0006');
  });
});

