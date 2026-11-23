import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { formatErrorMessage, getApiBaseUrl, REMOTE_API_BASE_URL } from '../api.ts';

describe('API Helpers & Error Formatting Tests', () => {
  it('formats standard Error messages cleanly', () => {
    const err = new Error('Database connection failed');
    assert.equal(formatErrorMessage(err), 'Database connection failed');
  });

  it('safely extracts message from error with empty message but with code', () => {
    const err = new Error('');
    (err as unknown as { code: string }).code = 'ECONNREFUSED';
    assert.equal(formatErrorMessage(err), 'Connection failed (ECONNREFUSED)');
  });

  it('safely formats AggregateError without leaking iterable null or empty message', () => {
    const sub1 = new Error('connect ECONNREFUSED ::1:3000');
    const sub2 = new Error('connect ECONNREFUSED 127.0.0.1:3000');
    const aggErr = new AggregateError([sub1, sub2], '');
    const formatted = formatErrorMessage(aggErr);
    assert.ok(formatted.includes('ECONNREFUSED'));
    assert.equal(typeof formatted, 'string');
    assert.notEqual(formatted, '');
  });

  it('handles null, undefined, and non-error values gracefully', () => {
    assert.equal(formatErrorMessage(null), 'Unknown error');
    assert.equal(formatErrorMessage(undefined), 'Unknown error');
    assert.equal(formatErrorMessage('Custom error string'), 'Custom error string');
  });

  it('resolves remote API URL when public url contains salon-main-website', () => {
    const prev = process.env.NEXT_PUBLIC_API_URL;
    try {
      process.env.NEXT_PUBLIC_API_URL = 'https://salon-main-website.vercel.app/api';
      assert.equal(getApiBaseUrl(), REMOTE_API_BASE_URL);
    } finally {
      process.env.NEXT_PUBLIC_API_URL = prev;
    }
  });
});
