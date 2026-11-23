export async function generateSequentialCode(
  tx: { $queryRawUnsafe: <T>(query: string, ...values: unknown[]) => Promise<T> },
  table: string,
  prefix: string,
  column = 'code',
): Promise<string> {
  const targetColumn =
    column === 'reference_no' || table.includes('stock_receipts') || prefix === 'SIN-'
      ? 'reference_no'
      : 'code';

  const maxRows = await tx.$queryRawUnsafe<Array<{ max_num: number | null }>>(
    `SELECT MAX(
       NULLIF(
         regexp_replace("${targetColumn}", '^' || $1, ''),
         "${targetColumn}"
       )::int
     ) AS max_num
     FROM ${table}
     WHERE "${targetColumn}" LIKE $1 || '%'
       AND "${targetColumn}" ~ ('^' || $1 || '[0-9]+$')`,
    prefix,
  );

  let next = (Number(maxRows[0]?.max_num) || 0) + 1;
  let candidate = `${prefix}${String(next).padStart(4, '0')}`;

  // Collision safety: guarantees the candidate code does not exist in the table,
  // incrementing until an unused code is found.
  while (true) {
    const existing = await tx.$queryRawUnsafe<Array<{ exists?: number }>>(
      `SELECT 1 FROM ${table} WHERE "${targetColumn}" = $1 LIMIT 1`,
      candidate,
    );
    if (!existing || existing.length === 0) {
      break;
    }
    next++;
    candidate = `${prefix}${String(next).padStart(4, '0')}`;
  }

  return candidate;
}
