import { NextResponse } from 'next/server';
import { fetchPublicPlans, formatErrorMessage } from '@/lib/api';
import { DEFAULT_FALLBACK_PLANS } from '@/lib/plans';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  try {
    const plans = await fetchPublicPlans();
    return NextResponse.json(plans, {
      status: 200,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Content-Type': 'application/json',
      },
    });
  } catch (error) {
    console.warn(
      `[Plans Route Handler] Note: Falling back to default plans (${formatErrorMessage(error)})`,
    );
    return NextResponse.json(DEFAULT_FALLBACK_PLANS, {
      status: 200,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Content-Type': 'application/json',
      },
    });
  }
}

