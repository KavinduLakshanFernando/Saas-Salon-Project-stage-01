/**
 * Configuration and utilities for Admin-Assisted Subscription Upgrade & Downgrade
 * via WhatsApp & Offline Bank Transfer.
 */

/**
 * Platform configured WhatsApp number for Super Admin billing assistance.
 * Configurable via VITE_ADMIN_WHATSAPP_NUMBER environment variable,
 * with standard platform fallback.
 */
export const ADMIN_WHATSAPP_NUMBER =
  (import.meta.env.VITE_ADMIN_WHATSAPP_NUMBER as string | undefined)?.trim() || '94774552144';

export interface BankTransferDetails {
  bankName: string;
  accountName: string;
  accountNumber: string;
  branch: string;
  notes?: string;
}

/**
 * Bank account instructions for manual payment settlements.
 * Overridable through Vite environment variables.
 */
export const BANK_TRANSFER_DETAILS: BankTransferDetails = {
  bankName:
    (import.meta.env.VITE_BANK_NAME as string | undefined)?.trim() || 'Commercial Bank of Ceylon',
  accountName:
    (import.meta.env.VITE_BANK_ACCOUNT_NAME as string | undefined)?.trim() ||
    'Dart Enterprise (Pvt) Ltd',
  accountNumber:
    (import.meta.env.VITE_BANK_ACCOUNT_NUMBER as string | undefined)?.trim() || '100012345678',
  branch: (import.meta.env.VITE_BANK_BRANCH as string | undefined)?.trim() || 'Colombo City Branch',
  notes: 'Please attach your deposit receipt/slip in the WhatsApp chat for Super Admin payment verification.',
};

export interface WhatsAppPlanChangeParams {
  salonName: string;
  currentPlan: string;
  targetPlan: string;
  billingCycle: string;
  tierChange?: 'upgrade' | 'downgrade' | 'same';
  amount?: number | string | null;
  downgradeCredit?: number | string | null;
  creditCarriedForward?: number | string | null;
  nextRenewalPayable?: number | string | null;
  currency?: string;
  customWhatsAppNumber?: string;
}

/**
 * Builds the official WhatsApp click-to-chat URL:
 * https://wa.me/{configuredAdminNumber}?text={encodedMessage}
 */
export function buildWhatsAppPlanChangeUrl(params: WhatsAppPlanChangeParams): string {
  const rawNumber = params.customWhatsAppNumber || ADMIN_WHATSAPP_NUMBER;
  const sanitizedNumber = rawNumber.replace(/[^0-9]/g, '');
  const currency = params.currency || 'LKR';
  const formatMoney = (val: number | string) =>
    `${currency} ${Number(val).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const isDowngrade = params.tierChange === 'downgrade';

  const messageLines: string[] = [
    isDowngrade
      ? 'Hello, I would like to request a subscription plan downgrade.'
      : 'Hello, I would like to request a subscription plan change.',
    `Salon: ${params.salonName || 'My Salon'}`,
    `Current Plan: ${params.currentPlan}`,
    `Requested Plan: ${params.targetPlan}`,
    `Billing Cycle: ${params.billingCycle}`,
  ];

  if (isDowngrade) {
    if (params.downgradeCredit !== undefined && params.downgradeCredit !== null && Number(params.downgradeCredit) > 0) {
      messageLines.push(`Estimated Credit Carried Forward: ${formatMoney(params.downgradeCredit)}`);
    }
    if (params.nextRenewalPayable !== undefined && params.nextRenewalPayable !== null) {
      messageLines.push(`Estimated Next Renewal Payment: ${formatMoney(params.nextRenewalPayable)}`);
    }
    messageLines.push('Please review my downgrade request and credit adjustment.');
  } else {
    const amountStr =
      params.amount !== undefined && params.amount !== null
        ? formatMoney(params.amount)
        : `${currency} 0.00`;
    messageLines.push(`Prorated Additional Amount: ${amountStr}`);
    messageLines.push('I will attach my bank transfer slip for verification.');
    messageLines.push('Please verify my payment and update my subscription.');
  }

  const encodedText = encodeURIComponent(messageLines.join('\n'));
  return `https://wa.me/${sanitizedNumber}?text=${encodedText}`;
}
