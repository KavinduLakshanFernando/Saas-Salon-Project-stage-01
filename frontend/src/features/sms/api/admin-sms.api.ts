import api from '@/api/axios';
import type {
  AdminSalonSmsItem,
  SmsLogItem,
  SmsRechargeRequestItem,
  SmsTransactionItem,
  SmsWalletOverview,
} from '../types/sms.types';
import type { PaginatedResult } from './sms.api';

export interface ActivateSmsPayload {
  credits?: number;
  notes?: string;
}

export interface AddCreditsPayload {
  credits: number;
  notes?: string;
}

export const adminSmsApi = {
  listSalons: (params?: {
    search?: string;
    status?: string;
    plan?: string;
    page?: number;
    limit?: number;
  }) =>
    api
      .get<PaginatedResult<AdminSalonSmsItem>>('/super-admin/sms/salons', { params })
      .then((r) => r.data),

  listRechargeRequests: (params?: {
    status?: string;
    tenantId?: string;
    search?: string;
    page?: number;
    limit?: number;
  }) =>
    api
      .get<PaginatedResult<SmsRechargeRequestItem>>('/super-admin/sms/recharge-requests', {
        params,
      })
      .then((r) => r.data),

  fulfillRechargeRequest: (
    id: string,
    data?: { credits?: number; adminNotes?: string },
  ) =>
    api
      .post<{
        success: boolean;
        message: string;
        request: SmsRechargeRequestItem;
        wallet: any;
      }>(`/super-admin/sms/recharge-requests/${id}/fulfill`, data || {})
      .then((r) => r.data),

  rejectRechargeRequest: (id: string, reason: string) =>
    api
      .post<{
        success: boolean;
        message: string;
        request: SmsRechargeRequestItem;
      }>(`/super-admin/sms/recharge-requests/${id}/reject`, { reason })
      .then((r) => r.data),

  activateSms: (tenantId: string, payload?: ActivateSmsPayload) =>
    api
      .post<{
        success: boolean;
        message: string;
        creditsAllocated: number;
        wallet: any;
      }>(`/super-admin/sms/salons/${tenantId}/activate`, payload || {})
      .then((r) => r.data),

  addCredits: (tenantId: string, payload: AddCreditsPayload) =>
    api
      .post<{
        success: boolean;
        message: string;
        creditsAdded: number;
        wallet: any;
      }>(`/super-admin/sms/salons/${tenantId}/add-credits`, payload)
      .then((r) => r.data),

  deactivateSms: (tenantId: string, reason?: string) =>
    api
      .post<{ success: boolean; message: string; wallet: any }>(
        `/super-admin/sms/salons/${tenantId}/deactivate`,
        { reason },
      )
      .then((r) => r.data),

  getTenantWallet: (tenantId: string) =>
    api.get<SmsWalletOverview>(`/super-admin/sms/wallets/${tenantId}`).then((r) => r.data),

  updateThreshold: (tenantId: string, threshold: number) =>
    api
      .patch(`/super-admin/sms/wallets/${tenantId}/threshold`, { threshold })
      .then((r) => r.data),

  adjustCredits: (tenantId: string, amount: number, reason: string) =>
    api
      .post(`/super-admin/sms/wallets/${tenantId}/adjust`, { amount, reason })
      .then((r) => r.data),

  getGlobalTransactions: (params?: {
    tenantId?: string;
    page?: number;
    limit?: number;
    type?: string;
  }) =>
    api
      .get<PaginatedResult<SmsTransactionItem>>('/super-admin/sms/transactions', { params })
      .then((r) => r.data),

  getGlobalLogs: (params?: {
    tenantId?: string;
    page?: number;
    limit?: number;
    status?: string;
  }) =>
    api
      .get<PaginatedResult<SmsLogItem>>('/super-admin/sms/logs', { params })
      .then((r) => r.data),
};
