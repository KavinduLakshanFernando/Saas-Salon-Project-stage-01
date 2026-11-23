import api from '@/api/axios';
import type { PayHereCheckout } from '@/features/signup/api/signup.api';
import type {
  SmsCalculationResponse,
  SmsLogItem,
  SmsManualPaymentItem,
  SmsPackageItem,
  SmsRechargeRequestItem,
  SmsTransactionItem,
  SmsWalletOverview,
} from '../types/sms.types';

export interface PaginatedResult<T> {
  data: T[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export const smsApi = {
  getWallet: () =>
    api.get<SmsWalletOverview>('/sms/wallet').then((r) => r.data),

  getPackages: () =>
    api.get<SmsPackageItem[]>('/sms/packages').then((r) => r.data),

  createCheckout: (
    payload: string | { amount?: number; packageId?: string; gateway?: string },
    gatewayParam: string = 'PAYHERE',
  ) => {
    const body =
      typeof payload === 'string'
        ? { packageId: payload, gateway: gatewayParam }
        : { gateway: 'PAYHERE', ...payload };
    return api
      .post<{
        orderReference: string;
        paymentOrderId: string;
        gateway: string;
        checkout: PayHereCheckout;
      }>('/sms/checkout', body)
      .then((r) => r.data);
  },

  createRechargeRequest: (data: {
    packageId?: string;
    requestedCredits?: number;
    ownerMessage?: string;
  }) =>
    api
      .post<SmsRechargeRequestItem>('/sms/recharge-requests', data)
      .then((r) => r.data),

  getRechargeRequests: (page: number = 1, limit: number = 10, status?: string) =>
    api
      .get<PaginatedResult<SmsRechargeRequestItem>>('/sms/recharge-requests', {
        params: { page, limit, status },
      })
      .then((r) => r.data),

  cancelRechargeRequest: (requestId: string) =>
    api
      .post<SmsRechargeRequestItem>(`/sms/recharge-requests/${requestId}/cancel`)
      .then((r) => r.data),

  getManualPayments: (page: number = 1, limit: number = 10) =>
    api
      .get<PaginatedResult<SmsManualPaymentItem>>('/sms/manual-payments', {
        params: { page, limit },
      })
      .then((r) => r.data),

  getTransactions: (page: number = 1, limit: number = 10, type?: string) =>
    api
      .get<PaginatedResult<SmsTransactionItem>>('/sms/transactions', {
        params: { page, limit, type },
      })
      .then((r) => r.data),

  getLogs: (page: number = 1, limit: number = 10, status?: string) =>
    api
      .get<PaginatedResult<SmsLogItem>>('/sms/logs', {
        params: { page, limit, status },
      })
      .then((r) => r.data),

  calculate: (text: string) =>
    api
      .get<SmsCalculationResponse>('/sms/calculate', {
        params: { text },
      })
      .then((r) => r.data),
};

