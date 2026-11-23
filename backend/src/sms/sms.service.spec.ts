import { ConfigService } from '@nestjs/config';
import { SmsService } from './sms.service';

describe('SmsService', () => {
  let service: SmsService;
  let configService: { get: jest.Mock };

  beforeEach(() => {
    configService = {
      get: jest.fn((key: string, fallback?: unknown) => fallback),
    };
    service = new SmsService(configService as unknown as ConfigService);
  });

  describe('normalizePhoneNumber', () => {
    it('formats local Sri Lankan 0-prefixed numbers to +94', () => {
      expect(service.normalizePhoneNumber('0771234567')).toBe('+94771234567');
      expect(service.normalizePhoneNumber('077 123 4567')).toBe('+94771234567');
      expect(service.normalizePhoneNumber('071-987-6543')).toBe('+94719876543');
    });

    it('preserves numbers already in E.164 format', () => {
      expect(service.normalizePhoneNumber('+94771234567')).toBe('+94771234567');
      expect(service.normalizePhoneNumber('+14155552671')).toBe('+14155552671');
    });

    it('prepends + to country code numbers missing plus', () => {
      expect(service.normalizePhoneNumber('94771234567')).toBe('+94771234567');
    });
  });

  describe('sendSms', () => {
    it('returns error when SMS_ENABLED is false', async () => {
      configService.get.mockImplementation((key: string) => {
        if (key === 'SMS_ENABLED') return 'false';
        return undefined;
      });

      const result = await service.sendSms('0771234567', 'Test message');
      expect(result.success).toBe(false);
      expect(result.error).toContain('disabled');
    });

    it('returns dev-mock success in development when SMS_API_URL is empty', async () => {
      configService.get.mockImplementation((key: string) => {
        if (key === 'SMS_ENABLED') return 'true';
        if (key === 'NODE_ENV') return 'development';
        if (key === 'SMS_API_URL') return undefined;
        return undefined;
      });

      const result = await service.sendSms('0771234567', 'Test bill message');
      expect(result.success).toBe(true);
      expect(result.messageId).toContain('dev-mock-');
    });

    it('calls external gateway via fetch when configured', async () => {
      configService.get.mockImplementation((key: string) => {
        if (key === 'SMS_ENABLED') return 'true';
        if (key === 'SMS_API_URL') return 'https://sms-gw.example.com/api/send';
        if (key === 'SMS_API_KEY') return 'secret-key-123';
        if (key === 'SMS_SENDER_ID') return 'SALON_VIP';
        return undefined;
      });

      const mockFetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ message_id: 'gw-msg-999' }),
      });
      global.fetch = mockFetch;

      const result = await service.sendSms('0771234567', 'Your bill receipt');
      expect(result.success).toBe(true);
      expect(result.messageId).toBe('gw-msg-999');
      expect(mockFetch).toHaveBeenCalledWith(
        'https://sms-gw.example.com/api/send',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: 'Bearer secret-key-123',
          }),
        }),
      );
    });

    it('gracefully handles gateway error status without throwing', async () => {
      configService.get.mockImplementation((key: string) => {
        if (key === 'SMS_ENABLED') return 'true';
        if (key === 'SMS_API_URL') return 'https://sms-gw.example.com/api/send';
        return undefined;
      });

      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 400,
        text: async () => 'Invalid recipient phone',
      });

      const result = await service.sendSms('invalid', 'Test');
      expect(result.success).toBe(false);
      expect(result.error).toContain('HTTP 400');
    });

    it('dispatches to SMSLenz gateway when SMS_PROVIDER=smslenz', async () => {
      configService.get.mockImplementation((key: string) => {
        if (key === 'SMS_ENABLED') return 'true';
        if (key === 'SMS_PROVIDER') return 'smslenz';
        if (key === 'SMSLENZ_BASE_URL') return 'https://smslenz.lk';
        if (key === 'SMSLENZ_USER_ID') return '1862';
        if (key === 'SMSLENZ_API_KEY') return 'b706c1f8-0231-4d15-bb1a-d4616f3e3ef6';
        if (key === 'SMSLENZ_SENDER_ID') return 'DARTCODES';
        return undefined;
      });

      const mockFetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          message: 'SMS sent successfully',
          data: {
            status: 'success',
            campaign_id: 1042,
            message: 'E-Bill test',
            sender_id: 'DARTCODES',
            pages: 1,
            sms_credit_balance: '495.16',
          },
        }),
      });
      global.fetch = mockFetch;

      const result = await service.sendSms('0771234567', 'Test SMSLenz eBill');
      expect(result.success).toBe(true);
      expect(result.messageId).toBe('1042');
      expect(mockFetch).toHaveBeenCalledWith(
        'https://smslenz.lk/api/send-sms',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            user_id: '1862',
            api_key: 'b706c1f8-0231-4d15-bb1a-d4616f3e3ef6',
            sender_id: 'DARTCODES',
            contact: '+94771234567',
            message: 'Test SMSLenz eBill',
          }),
        }),
      );
    });
  });

  describe('sendTenantSms', () => {
    let mockPrisma: any;
    let mockWalletService: any;
    let tenantSmsService: SmsService;

    beforeEach(() => {
      mockPrisma = {
        smsMessageLog: {
          findUnique: jest.fn(),
          create: jest.fn().mockResolvedValue({ id: 'log-1' }),
          upsert: jest.fn().mockResolvedValue({ id: 'log-1' }),
        },
      };

      mockWalletService = {
        checkSmsEligibility: jest.fn(),
        deductCredits: jest.fn(),
        refundCredits: jest.fn(),
      };

      configService.get.mockImplementation((key: string) => {
        if (key === 'SMS_ENABLED') return 'true';
        if (key === 'NODE_ENV') return 'development';
        return undefined;
      });

      tenantSmsService = new SmsService(
        configService as unknown as ConfigService,
        mockPrisma,
        mockWalletService,
      );
    });

    it('blocks sending when SMS is disabled for Basic/Silver salon', async () => {
      mockWalletService.checkSmsEligibility.mockResolvedValue({
        canSend: false,
        isPlanCovered: false,
        availableCredits: 0,
        reason: 'SMS notifications are not activated for your salon. Please contact the Super Admin.',
      });

      const res = await tenantSmsService.sendTenantSms({
        tenantId: 'tenant-basic',
        to: '0771234567',
        message: 'Your bill is ready',
        purpose: 'EBILL',
        idempotencyKey: 'ebill-1',
      });

      expect(res.success).toBe(false);
      expect(res.creditsDeducted).toBe(0);
      expect(res.error).toContain('not activated');
      expect(mockWalletService.deductCredits).not.toHaveBeenCalled();
      expect(mockPrisma.smsMessageLog.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { idempotencyKey: 'ebill-1' },
          create: expect.objectContaining({
            status: 'FAILED',
            creditsDeducted: 0,
          }),
        }),
      );
    });

    it('blocks sending when Basic/Silver salon has insufficient credits', async () => {
      mockWalletService.checkSmsEligibility.mockResolvedValue({
        canSend: false,
        isPlanCovered: false,
        availableCredits: 0,
        reason: 'You have 0 SMS credits remaining.',
      });

      const res = await tenantSmsService.sendTenantSms({
        tenantId: 'tenant-basic',
        to: '0771234567',
        message: 'Your bill is ready',
        purpose: 'EBILL',
      });

      expect(res.success).toBe(false);
      expect(res.creditsDeducted).toBe(0);
      expect(res.error).toContain('0 SMS credits remaining');
      expect(mockWalletService.deductCredits).not.toHaveBeenCalled();
    });

    it('deducts exactly 1 credit for single-segment GSM-7 SMS on active Basic salon', async () => {
      mockWalletService.checkSmsEligibility.mockResolvedValue({
        canSend: true,
        isPlanCovered: false,
        availableCredits: 10,
      });

      mockWalletService.deductCredits.mockResolvedValue({
        deducted: true,
        balanceAfter: 9,
      });

      const res = await tenantSmsService.sendTenantSms({
        tenantId: 'tenant-basic',
        to: '0771234567',
        message: 'Hello, your appointment is confirmed.',
        purpose: 'APPOINTMENT',
      });

      expect(res.success).toBe(true);
      expect(res.segments).toBe(1);
      expect(res.creditsDeducted).toBe(1);
      expect(res.remainingBalance).toBe(9);
      expect(mockWalletService.deductCredits).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: 'tenant-basic',
          credits: 1,
        }),
      );
      expect(mockPrisma.smsMessageLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'SUBMITTED',
            creditsDeducted: 1,
          }),
        }),
      );
    });

    it('calculates multiple segments and deducts multiple credits for long GSM-7 SMS', async () => {
      mockWalletService.checkSmsEligibility.mockResolvedValue({
        canSend: true,
        isPlanCovered: false,
        availableCredits: 20,
      });

      mockWalletService.deductCredits.mockResolvedValue({
        deducted: true,
        balanceAfter: 18,
      });

      const longMessage = 'A'.repeat(200); // 200 chars GSM-7 = 2 segments
      const res = await tenantSmsService.sendTenantSms({
        tenantId: 'tenant-basic',
        to: '0771234567',
        message: longMessage,
      });

      expect(res.success).toBe(true);
      expect(res.segments).toBe(2);
      expect(res.creditsDeducted).toBe(2);
      expect(mockWalletService.deductCredits).toHaveBeenCalledWith(
        expect.objectContaining({
          credits: 2,
        }),
      );
    });

    it('detects Unicode Sinhala message and deducts calculated segments', async () => {
      mockWalletService.checkSmsEligibility.mockResolvedValue({
        canSend: true,
        isPlanCovered: false,
        availableCredits: 10,
      });

      mockWalletService.deductCredits.mockResolvedValue({
        deducted: true,
        balanceAfter: 8,
      });

      // Sinhala text repeated (> 70 chars UCS-2 = 2 segments)
      const sinhalaMessage = 'ඔබගේ වේලාව වෙන්කරවා ගැනීම තහවුරු කරන ලදී.'.repeat(2);
      const res = await tenantSmsService.sendTenantSms({
        tenantId: 'tenant-basic',
        to: '0771234567',
        message: sinhalaMessage,
      });

      expect(res.success).toBe(true);
      expect(res.segments).toBeGreaterThanOrEqual(2);
      expect(res.creditsDeducted).toBe(res.segments);
      expect(mockWalletService.deductCredits).toHaveBeenCalledWith(
        expect.objectContaining({
          credits: res.segments,
        }),
      );
    });

    it('bypasses credit deduction for Gold/Platinum/Enterprise plan-covered salons', async () => {
      mockWalletService.checkSmsEligibility.mockResolvedValue({
        canSend: true,
        isPlanCovered: true,
        availableCredits: Infinity,
      });

      const res = await tenantSmsService.sendTenantSms({
        tenantId: 'tenant-gold',
        to: '0771234567',
        message: 'Plan included notification',
      });

      expect(res.success).toBe(true);
      expect(res.isPlanCovered).toBe(true);
      expect(res.creditsDeducted).toBe(0);
      expect(mockWalletService.deductCredits).not.toHaveBeenCalled();
    });

    it('refunds deducted credits when gateway fails to dispatch', async () => {
      mockWalletService.checkSmsEligibility.mockResolvedValue({
        canSend: true,
        isPlanCovered: false,
        availableCredits: 10,
      });

      mockWalletService.deductCredits.mockResolvedValue({
        deducted: true,
        balanceAfter: 9,
      });

      mockWalletService.refundCredits.mockResolvedValue({
        refunded: true,
        balanceAfter: 10,
      });

      // Force sendSms to fail
      configService.get.mockImplementation((key: string) => {
        if (key === 'SMS_ENABLED') return 'false';
        return undefined;
      });

      const res = await tenantSmsService.sendTenantSms({
        tenantId: 'tenant-basic',
        to: '0771234567',
        message: 'Test bill',
        idempotencyKey: 'fail-key-1',
      });

      expect(res.success).toBe(false);
      expect(res.creditsDeducted).toBe(0);
      expect(mockWalletService.refundCredits).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: 'tenant-basic',
          credits: 1,
          reference: 'fail-key-1',
        }),
      );
      expect(mockPrisma.smsMessageLog.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { idempotencyKey: 'fail-key-1' },
          create: expect.objectContaining({
            status: 'FAILED',
            creditsDeducted: 0,
          }),
        }),
      );
    });

    it('returns existing success without deducting on idempotency hit', async () => {
      mockPrisma.smsMessageLog.findUnique.mockResolvedValue({
        id: 'log-existing',
        providerMessageId: 'gw-prev-123',
        segments: 1,
        creditsDeducted: 1,
        status: 'SUBMITTED',
      });

      const res = await tenantSmsService.sendTenantSms({
        tenantId: 'tenant-basic',
        to: '0771234567',
        message: 'Test message',
        idempotencyKey: 'idem-hit-1',
      });

      expect(res.success).toBe(true);
      expect(res.messageId).toBe('gw-prev-123');
      expect(mockWalletService.checkSmsEligibility).not.toHaveBeenCalled();
      expect(mockWalletService.deductCredits).not.toHaveBeenCalled();
    });
  });
});
