import { Injectable, Logger, Optional, Inject, forwardRef } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SmsDeliveryStatus } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { calculateSmsSegments, maskPhoneNumber } from './sms-calculator.util';
import { SmsWalletService } from './sms-wallet.service';

export interface SmsSendResult {
  success: boolean;
  messageId?: string | null;
  error?: string | null;
}

export interface SendTenantSmsParams {
  tenantId: string;
  to: string;
  message: string;
  purpose?: string;
  idempotencyKey?: string;
  metadata?: any;
}

export interface SendTenantSmsResult {
  success: boolean;
  messageId?: string | null;
  segments: number;
  creditsDeducted: number;
  remainingBalance?: number;
  error?: string | null;
  isPlanCovered?: boolean;
}

@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name);

  constructor(
    private readonly configService: ConfigService,
    @Optional()
    private readonly prisma?: PrismaService,
    @Optional()
    @Inject(forwardRef(() => SmsWalletService))
    private readonly smsWalletService?: SmsWalletService,
  ) {}

  /**
   * Normalizes mobile numbers to E.164-compatible format.
   * e.g. "077 123 4567" -> "+94771234567"
   * e.g. "+94771234567" -> "+94771234567"
   */
  normalizePhoneNumber(phone: string): string {
    const cleaned = phone.replace(/[\s\-()]/g, '');
    if (cleaned.startsWith('0')) {
      return `+94${cleaned.slice(1)}`;
    }
    if (cleaned.startsWith('94') && !cleaned.startsWith('+')) {
      return `+${cleaned}`;
    }
    if (!cleaned.startsWith('+') && cleaned.length >= 9) {
      return `+${cleaned}`;
    }
    return cleaned;
  }

  /**
   * Sends an SMS message via the configured SMS Gateway (SMSLenz or generic REST API).
   * Fully non-throwing: returns { success: boolean, messageId?: string, error?: string }.
   */
  async sendSms(to: string, message: string): Promise<SmsSendResult> {
    const enabledRaw = this.configService.get<string | boolean>('SMS_ENABLED');
    const isEnabled = enabledRaw === undefined || enabledRaw === true || enabledRaw === 'true' || enabledRaw === '1';
    const isDev = (this.configService.get<string>('NODE_ENV') ?? 'development') !== 'production';
    const normalizedRecipient = this.normalizePhoneNumber(to);

    if (!isEnabled) {
      this.logger.warn(`SMS is disabled via SMS_ENABLED. Skipping send to ${normalizedRecipient}.`);
      return {
        success: false,
        error: 'SMS service is disabled',
      };
    }

    // 1. Check for SMSLenz Gateway Provider
    const provider = (this.configService.get<string>('SMS_PROVIDER') ?? '').toLowerCase();
    const smslenzApiKey = this.configService.get<string>('SMSLENZ_API_KEY')?.trim();
    const smslenzUserId = this.configService.get<string | number>('SMSLENZ_USER_ID')?.toString().trim();
    const isSmslenz = provider === 'smslenz' || Boolean(smslenzApiKey && smslenzUserId);

    if (isSmslenz) {
      return this.sendViaSmslenz(normalizedRecipient, message, {
        userId: smslenzUserId,
        apiKey: smslenzApiKey,
      });
    }

    // 2. Generic HTTP POST Gateway
    const apiUrl = this.configService.get<string>('SMS_API_URL')?.trim();
    const apiKey = this.configService.get<string>('SMS_API_KEY')?.trim();
    const senderId = this.configService.get<string>('SMS_SENDER_ID')?.trim() || 'SALON';
    const username = this.configService.get<string>('SMS_USERNAME')?.trim();
    const password = this.configService.get<string>('SMS_PASSWORD')?.trim();
    const timeoutMs = Number(this.configService.get<number>('SMS_TIMEOUT_MS')) || 10000;

    // Dev/Mock fallback when no external API URL is provided
    if (!apiUrl) {
      this.logger.log(
        `[DEV SMS] (No gateway configured) To: ${normalizedRecipient}\n` +
          `[DEV SMS] Sender: ${senderId}\n` +
          `[DEV SMS] Content (${message.length} chars):\n${message}\n---`,
      );

      if (isDev) {
        return {
          success: true,
          messageId: `dev-mock-${Date.now()}`,
        };
      }

      return {
        success: false,
        error: 'SMS gateway URL (SMS_API_URL / SMSLENZ_API_KEY) is not configured',
      };
    }

    // Dispatch generic HTTP POST request
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      };

      if (apiKey) {
        headers['Authorization'] = `Bearer ${apiKey}`;
        headers['x-api-key'] = apiKey;
      } else if (username && password) {
        const credentials = Buffer.from(`${username}:${password}`).toString('base64');
        headers['Authorization'] = `Basic ${credentials}`;
      }

      const payload = {
        to: normalizedRecipient,
        recipient: normalizedRecipient,
        phone: normalizedRecipient,
        message,
        text: message,
        sender_id: senderId,
        from: senderId,
      };

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      clearTimeout(timer);

      if (!response.ok) {
        const errText = await response.text().catch(() => '');
        const errMsg = `SMS Gateway returned HTTP ${response.status}: ${errText.slice(0, 150)}`;
        this.logger.error(`SMS dispatch failed: ${errMsg}`);
        return {
          success: false,
          error: errMsg,
        };
      }

      let data: any = null;
      try {
        data = await response.json();
      } catch {
        // Plain text response
      }

      const messageId =
        data?.message_id || data?.id || data?.msg_id || data?.reference || `sms-${Date.now()}`;

      this.logger.log(`SMS successfully dispatched to ${normalizedRecipient} (ID: ${messageId})`);

      return {
        success: true,
        messageId: String(messageId),
      };
    } catch (err: any) {
      clearTimeout(timer);
      const isTimeout = err?.name === 'AbortError';
      const errMsg = isTimeout
        ? `SMS dispatch timed out after ${timeoutMs}ms`
        : err?.message || 'Network error while contacting SMS gateway';

      this.logger.error(`SMS send error for ${normalizedRecipient}: ${errMsg}`);
      return {
        success: false,
        error: errMsg,
      };
    }
  }

  /**
   * Dispatches an SMS via the SMSLenz.lk gateway API.
   * Endpoint: POST https://smslenz.lk/api/send-sms
   */
  private async sendViaSmslenz(
    recipient: string,
    message: string,
    creds: { userId?: string; apiKey?: string },
  ): Promise<SmsSendResult> {
    const baseUrl = this.configService.get<string>('SMSLENZ_BASE_URL')?.trim() || 'https://smslenz.lk';
    const endpoint = `${baseUrl.replace(/\/$/, '')}/api/send-sms`;
    const userId = creds.userId || this.configService.get<string>('SMSLENZ_USER_ID')?.trim();
    const apiKey = creds.apiKey || this.configService.get<string>('SMSLENZ_API_KEY')?.trim();
    const senderId =
      this.configService.get<string>('SMSLENZ_SENDER_ID')?.trim() ||
      this.configService.get<string>('SMS_SENDER_ID')?.trim() ||
      'DARTCODES';
    const timeoutMs =
      Number(
        this.configService.get<number>('SMSLENZ_READ_TIMEOUT_MS') ||
          this.configService.get<number>('SMSLENZ_CONNECTION_TIMEOUT_MS') ||
          this.configService.get<number>('SMS_TIMEOUT_MS'),
      ) || 30000;

    if (!userId || !apiKey) {
      return {
        success: false,
        error: 'SMSLENZ_USER_ID and SMSLENZ_API_KEY must be configured',
      };
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const payload = {
        user_id: String(userId),
        api_key: apiKey,
        sender_id: senderId,
        contact: recipient,
        message,
      };

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      clearTimeout(timer);

      const data: any = await response.json().catch(() => null);

      if (!response.ok || (data && data.success === false)) {
        const errMsg =
          data?.message ||
          (data?.errors
            ? Object.values(data.errors).flat().join(', ')
            : `SMSlenz returned HTTP ${response.status}`);
        this.logger.error(`SMSlenz dispatch failed: ${errMsg}`);
        return {
          success: false,
          error: errMsg,
        };
      }

      const messageId =
        data?.data?.campaign_id ||
        data?.data?.message_id ||
        data?.campaign_id ||
        `smslenz-${Date.now()}`;

      this.logger.log(
        `SMSlenz successfully sent to ${recipient} (Campaign ID: ${messageId}, Balance: ${data?.data?.sms_credit_balance ?? 'N/A'})`,
      );

      return {
        success: true,
        messageId: String(messageId),
      };
    } catch (err: any) {
      clearTimeout(timer);
      const isTimeout = err?.name === 'AbortError';
      const errMsg = isTimeout
        ? `SMSlenz request timed out after ${timeoutMs}ms`
        : err?.message || 'Network error while contacting SMSlenz gateway';

      this.logger.error(`SMSlenz send error for ${recipient}: ${errMsg}`);
      return {
        success: false,
        error: errMsg,
      };
    }
  }

  /**
   * Dispatches an SMS on behalf of a tenant.
   * Handles segment calculation, balance checks, pre-send atomic credit deduction,
   * SMSLenz gateway dispatch, refund on provider rejection, idempotency, and audit logging.
   * Non-blocking: returns detailed result without throwing crashes.
   */
  async sendTenantSms(params: SendTenantSmsParams): Promise<SendTenantSmsResult> {
    const { tenantId, to, message, purpose, idempotencyKey, metadata } = params;

    // 1. Calculate SMS segments and character encoding
    const calculation = calculateSmsSegments(message);
    const segments = calculation.segments;

    // 2. Idempotency Check
    if (idempotencyKey && this.prisma) {
      try {
        const existing = await this.prisma.smsMessageLog.findUnique({
          where: { idempotencyKey },
        });

        if (
          existing &&
          (existing.status === SmsDeliveryStatus.SUBMITTED ||
            existing.status === SmsDeliveryStatus.DELIVERED)
        ) {
          this.logger.log(
            `SMS idempotency hit for key ${idempotencyKey}. Returning existing log ID ${existing.id}.`,
          );
          return {
            success: true,
            messageId: existing.providerMessageId,
            segments: existing.segments,
            creditsDeducted: existing.creditsDeducted,
            isPlanCovered: existing.creditsDeducted === 0,
          };
        }
      } catch (err: any) {
        this.logger.warn(`Idempotency check query error: ${err.message}`);
      }
    }

    // 3. Eligibility & Quota Check
    let isPlanCovered = false;
    let availableCredits = 0;

    if (this.smsWalletService) {
      const eligibility = await this.smsWalletService.checkSmsEligibility(tenantId, segments);
      isPlanCovered = eligibility.isPlanCovered;
      availableCredits = eligibility.availableCredits;

      if (!eligibility.canSend) {
        this.logger.warn(
          `Tenant ${tenantId} blocked from sending SMS (${segments} credit required, balance ${availableCredits}): ${eligibility.reason}`,
        );

        await this.recordMessageLog({
          tenantId,
          recipient: to,
          message,
          purpose: purpose || 'GENERAL',
          segments,
          creditsDeducted: 0,
          status: SmsDeliveryStatus.FAILED,
          provider: 'SMSLENZ',
          providerError: eligibility.reason || 'Insufficient SMS credits',
          idempotencyKey,
        });

        return {
          success: false,
          segments,
          creditsDeducted: 0,
          remainingBalance: availableCredits,
          error: eligibility.reason || 'Insufficient SMS credits',
          isPlanCovered: false,
        };
      }
    }

    // 4. Atomic Credit Deduction (if not covered under higher-tier base plan quota)
    let deductionResult = { deducted: false, balanceAfter: availableCredits };
    if (this.smsWalletService && !isPlanCovered) {
      try {
        deductionResult = await this.smsWalletService.deductCredits({
          tenantId,
          credits: segments,
          purpose: purpose || 'GENERAL',
          recipient: to,
          reference: idempotencyKey,
          idempotencyKey,
          metadata: {
            encoding: calculation.encoding,
            charCount: calculation.charCount,
            segments,
            ...(metadata || {}),
          },
        });
      } catch (err: any) {
        this.logger.error(`Failed to deduct SMS credits for tenant ${tenantId}: ${err.message}`);
        return {
          success: false,
          segments,
          creditsDeducted: 0,
          error: err.message || 'Failed to deduct SMS credits',
          isPlanCovered: false,
        };
      }
    }

    // 5. Send message via SMS Gateway
    const sendResult = await this.sendSms(to, message);

    // 6. Handle Provider Response
    if (sendResult.success) {
      await this.recordMessageLog({
        tenantId,
        recipient: to,
        message,
        purpose: purpose || 'GENERAL',
        segments,
        creditsDeducted: deductionResult.deducted ? segments : 0,
        status: SmsDeliveryStatus.SUBMITTED,
        provider: 'SMSLENZ',
        providerMessageId: sendResult.messageId || null,
        idempotencyKey,
      });

      return {
        success: true,
        messageId: sendResult.messageId,
        segments,
        creditsDeducted: deductionResult.deducted ? segments : 0,
        remainingBalance: deductionResult.balanceAfter,
        isPlanCovered,
      };
    } else {
      // Gateway rejected message before acceptance; refund reserved credits
      if (deductionResult.deducted && this.smsWalletService) {
        await this.smsWalletService
          .refundCredits({
            tenantId,
            credits: segments,
            reason: `SMS provider dispatch error: ${sendResult.error || 'Unknown error'}`,
            reference: idempotencyKey,
            recipient: to,
          })
          .catch((e) => this.logger.error(`Failed to refund SMS credits: ${e.message}`));
      }

      await this.recordMessageLog({
        tenantId,
        recipient: to,
        message,
        purpose: purpose || 'GENERAL',
        segments,
        creditsDeducted: 0,
        status: SmsDeliveryStatus.FAILED,
        provider: 'SMSLENZ',
        providerError: sendResult.error || 'Provider dispatch failed',
        idempotencyKey,
      });

      return {
        success: false,
        segments,
        creditsDeducted: 0,
        remainingBalance:
          deductionResult.balanceAfter + (deductionResult.deducted ? segments : 0),
        error: sendResult.error,
        isPlanCovered,
      };
    }
  }

  /**
   * Records or updates message log in a concurrency-safe, idempotent manner.
   * If an existing idempotencyKey was previously recorded as FAILED, an upsert
   * smoothly transitions it to SUBMITTED without unique constraint conflicts.
   */
  private async recordMessageLog(data: {
    tenantId: string;
    recipient: string;
    message: string;
    purpose: string;
    segments: number;
    creditsDeducted: number;
    status: SmsDeliveryStatus;
    provider: string;
    providerMessageId?: string | null;
    providerError?: string | null;
    idempotencyKey?: string | null;
  }) {
    if (!this.prisma) return;

    try {
      if (data.idempotencyKey) {
        await this.prisma.smsMessageLog.upsert({
          where: { idempotencyKey: data.idempotencyKey },
          update: {
            recipient: data.recipient,
            message: data.message,
            purpose: data.purpose,
            segments: data.segments,
            creditsDeducted: data.creditsDeducted,
            status: data.status,
            provider: data.provider,
            providerMessageId: data.providerMessageId || null,
            providerError: data.providerError || null,
          },
          create: {
            tenantId: data.tenantId,
            recipient: data.recipient,
            message: data.message,
            purpose: data.purpose,
            segments: data.segments,
            creditsDeducted: data.creditsDeducted,
            status: data.status,
            provider: data.provider,
            providerMessageId: data.providerMessageId || null,
            providerError: data.providerError || null,
            idempotencyKey: data.idempotencyKey,
          },
        });
      } else {
        await this.prisma.smsMessageLog.create({
          data: {
            tenantId: data.tenantId,
            recipient: data.recipient,
            message: data.message,
            purpose: data.purpose,
            segments: data.segments,
            creditsDeducted: data.creditsDeducted,
            status: data.status,
            provider: data.provider,
            providerMessageId: data.providerMessageId || null,
            providerError: data.providerError || null,
            idempotencyKey: null,
          },
        });
      }
    } catch (e: any) {
      this.logger.warn(`Failed to record SMS message log: ${e.message}`);
    }
  }
}
