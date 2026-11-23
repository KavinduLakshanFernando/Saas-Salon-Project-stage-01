export interface SmsWalletOverview {
  tenantId: string;
  balance: number;
  totalPurchased: number;
  totalConsumed: number;
  lowBalanceThreshold: number;
  isLowBalance: boolean;
  isOutOfCredits: boolean;
  isPlanCovered: boolean;
  canSend: boolean;
  status: 'PLAN_INCLUDED' | 'HEALTHY' | 'LOW' | 'EMPTY' | 'INACTIVE';
  isActive: boolean;
  activatedAt: string | null;
  initialBonusGranted: boolean;
  initialBonusGrantedAt: string | null;
  smsRateLkr: number;
}

export interface AdminSalonSmsItem {
  id: string;
  name: string;
  code: string;
  email: string | null;
  phone: string | null;
  status: string;
  createdAt: string;
  subscription: {
    id: string;
    status: string;
    plan: {
      id: string;
      code: string;
      name: string;
    } | null;
  } | null;
  isPlanCovered: boolean;
  planCode: string;
  planName: string;
  wallet: {
    id: string | null;
    balance: number;
    totalPurchased: number;
    totalConsumed: number;
    lowBalanceThreshold: number;
    isActive: boolean;
    activatedAt: string | null;
    initialBonusGranted: boolean;
    initialBonusGrantedAt: string | null;
  };
}

export interface SmsManualPaymentItem {
  id: string;
  tenantId: string;
  amount: number | string;
  credits: number;
  paymentMethod: 'BANK_TRANSFER' | 'CASH' | 'CHEQUE' | 'OTHER';
  paymentReference: string;
  paymentDate: string;
  notes: string | null;
  createdAt: string;
  confirmedBy?: {
    id: string;
    name: string;
    email: string;
  } | null;
  tenant?: {
    id: string;
    name: string;
    code?: string;
  } | null;
  creditTransaction?: {
    id: string;
    amount: number;
    balanceAfter: number;
  } | null;
}

export interface SmsTransactionItem {
  id: string;
  type: 'PURCHASE' | 'USAGE' | 'REFUND' | 'ADJUSTMENT' | 'INITIAL_BONUS';
  amount: number;
  balanceAfter: number;
  reference: string | null;
  description: string | null;
  createdAt: string;
  tenant?: {
    id: string;
    name: string;
  } | null;
  package?: {
    id: string;
    name: string;
  } | null;
  paymentOrder?: {
    id: string;
    reference: string;
    amount: number | string;
    currency: string;
  } | null;
}

export interface SmsLogItem {
  id: string;
  tenantId?: string;
  tenantName?: string;
  tenantCode?: string;
  recipientMasked: string;
  messagePreview: string;
  purpose: string;
  segments: number;
  creditsDeducted: number;
  status: 'PENDING' | 'SUBMITTED' | 'DELIVERED' | 'FAILED';
  provider: string;
  providerMessageId: string | null;
  providerError?: string | null;
  createdAt: string;
}

export interface SmsCalculationResponse {
  encoding: 'GSM_7' | 'UNICODE';
  charCount: number;
  effectiveLength: number;
  segmentCount: number;
  segments: number;
  creditsNeeded: number;
  creditsRequired: number;
  maxCharsPerSegment: number;
  charsRemainingInCurrentSegment: number;
}

export interface SmsPackageItem {
  id: string;
  name: string;
  description: string | null;
  credits: number;
  price: number;
  currency: string;
  isActive: boolean;
  displayOrder: number;
  isPopular?: boolean;
}

export interface SmsRechargeRequestItem {
  id: string;
  tenantId: string;
  packageId?: string | null;
  requestedCredits: number;
  amount?: number | string | null;
  ownerMessage?: string | null;
  ownerNotes?: string | null;
  status: 'PENDING' | 'APPROVED' | 'FULFILLED' | 'REJECTED' | 'CANCELLED';
  adminNotes?: string | null;
  rejectionReason?: string | null;
  actionedByAdminId?: string | null;
  creditTransactionId?: string | null;
  fulfilledAt?: string | null;
  createdAt: string;
  updatedAt: string;
  package?: {
    id: string;
    name: string;
    credits: number;
    creditCount?: number;
    price: number | string;
    currency: string;
  } | null;
  tenant?: {
    id: string;
    name: string;
    code: string;
    email?: string | null;
    phone?: string | null;
  } | null;
  actionedBy?: {
    id: string;
    name: string;
    email?: string;
  } | null;
  processedBy?: {
    id: string;
    name: string;
    email?: string;
  } | null;
  creditTransaction?: {
    id: string;
    amount: number;
    balanceAfter: number;
    createdAt: string;
  } | null;
}

