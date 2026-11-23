import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { WebsitesService } from './websites.service';
import { WebsiteStatus } from '@prisma/client';

describe('WebsitesService (Phase 1 & Phase 2)', () => {
  let service: WebsitesService;
  let mockPrisma: any;
  let mockTenantSchemaService: any;
  let mockConfigService: any;
  let mockStorageService: any;
  let mockSubscriptionFeatureService: any;
  let mockTx: any;

  const tenantId = '00000000-0000-0000-0000-000000000001';
  const schemaName = 'tenant_test_000001';

  beforeEach(() => {
    mockTx = {
      $queryRawUnsafe: jest.fn().mockResolvedValue([]),
    };

    mockPrisma = {
      salonWebsite: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      tenant: {
        findUnique: jest.fn(),
      },
    };

    mockTenantSchemaService = {
      withTenantSchema: jest.fn().mockImplementation((_schema, cb) => cb({ tx: mockTx })),
    };

    mockConfigService = {
      get: jest.fn().mockImplementation((key: string, defaultValue?: any) => {
        if (key === 'NODE_ENV') return 'development';
        if (key === 'PLATFORM_DOMAIN') return 'localhost';
        if (key === 'WEBSITES_PORT') return '3002';
        return defaultValue;
      }),
    };

    mockStorageService = {
      uploadFile: jest.fn().mockResolvedValue('https://example.com/uploads/photo.jpg'),
      deleteFile: jest.fn().mockResolvedValue(undefined),
    };

    mockSubscriptionFeatureService = {
      hasFeature: jest.fn(),
    };

    service = new WebsitesService(
      mockPrisma,
      mockTenantSchemaService,
      mockConfigService,
      mockStorageService,
      mockSubscriptionFeatureService,
    );
  });

  describe('provisionDraftWebsite', () => {
    it('returns existing website without creating duplicates', async () => {
      const existing = {
        id: 'web-1',
        tenantId,
        subdomain: 'salon-heart',
        status: WebsiteStatus.DRAFT,
      };
      mockPrisma.salonWebsite.findUnique.mockResolvedValueOnce(existing);

      const result = await service.provisionDraftWebsite(tenantId);
      expect(result).toBe(existing);
      expect(mockPrisma.salonWebsite.create).not.toHaveBeenCalled();
    });

    it('creates draft website with slugified unique subdomain when none exists', async () => {
      mockPrisma.salonWebsite.findUnique.mockResolvedValueOnce(null); // existing check
      mockPrisma.tenant.findUnique.mockResolvedValueOnce({
        id: tenantId,
        name: 'Salon Heart',
        code: 'SLN001',
        schemaName,
        phone: '0771122334',
        email: 'heart@salon.lk',
        primaryColor: '#7C3AED',
      });

      // Subdomain availability check: first candidate available
      mockPrisma.salonWebsite.findUnique.mockResolvedValueOnce(null);

      mockPrisma.salonWebsite.create.mockImplementation((args: any) =>
        Promise.resolve({
          id: 'web-1',
          ...args.data,
        }),
      );

      const result = await service.provisionDraftWebsite(tenantId);
      expect(result.subdomain).toBe('sln001');
      expect(result.title).toBe('Salon Heart');
      expect(result.status).toBe(WebsiteStatus.DRAFT);
      expect(result.isPublished).toBe(false);
      expect(mockPrisma.salonWebsite.create).toHaveBeenCalled();
    });

    it('handles duplicate subdomain by appending suffix', async () => {
      mockPrisma.salonWebsite.findUnique.mockResolvedValueOnce(null); // existing check
      mockPrisma.tenant.findUnique.mockResolvedValueOnce({
        id: tenantId,
        name: 'Salon Heart',
        code: 'SLN001',
        schemaName,
      });

      // First candidate conflict, second candidate available
      mockPrisma.salonWebsite.findUnique
        .mockResolvedValueOnce({ id: 'other-web', subdomain: 'sln001' })
        .mockResolvedValueOnce(null);

      mockPrisma.salonWebsite.create.mockImplementation((args: any) =>
        Promise.resolve({
          id: 'web-1',
          ...args.data,
        }),
      );

      const result = await service.provisionDraftWebsite(tenantId);
      expect(result.subdomain).toBe('sln001-1');
    });
  });

  describe('Template Management & Draft vs Published Workflow (Phase 2)', () => {
    it('returns the 3 distinct supported templates in template registry', () => {
      const templates = service.getAvailableTemplates();
      expect(templates.length).toBe(3);
      expect(templates.map((t) => t.id)).toEqual([
        'modern-beauty',
        'luxury-bridal',
        'spa-wellness',
      ]);
    });

    it('saveDraft modifies draftContent without changing publishedContent or isPublished status', async () => {
      const mockWeb = {
        id: 'web-1',
        tenantId,
        subdomain: 'salon-heart',
        title: 'Salon Heart',
        themeColor: '#7C3AED',
        templateId: 'modern-beauty',
        isPublished: true,
        status: WebsiteStatus.PUBLISHED,
        previewToken: 'tok123',
        publishedContent: { branding: { title: 'Salon Heart Live' } },
        draftContent: { branding: { title: 'Salon Heart Live' } },
        tenant: { name: 'Salon Heart' },
      };

      mockPrisma.salonWebsite.findUnique.mockResolvedValue(mockWeb);
      mockPrisma.salonWebsite.update.mockResolvedValue({
        ...mockWeb,
        templateId: 'luxury-bridal',
        draftContent: { branding: { title: 'Salon Heart Draft New' } },
      });

      const updated = await service.saveDraft(tenantId, {
        templateId: 'luxury-bridal',
        branding: { title: 'Salon Heart Draft New' },
      });

      expect(mockPrisma.salonWebsite.update).toHaveBeenCalled();
      const updatePayload = mockPrisma.salonWebsite.update.mock.calls[0][0];
      expect(updatePayload.data.templateId).toBe('luxury-bridal');
      expect(updatePayload.data.publishedContent).toBeUndefined(); // Did not touch publishedContent
    });

    it('publishWebsite promotes draftContent to publishedContent and activates live status', async () => {
      const draft = { branding: { title: 'Ready to Publish' }, hero: { headline: 'New Hero' } };
      const mockWeb = {
        id: 'web-1',
        tenantId,
        subdomain: 'salon-heart',
        templateId: 'modern-beauty',
        isPublished: false,
        status: WebsiteStatus.DRAFT,
        previewToken: 'tok123',
        draftContent: draft,
        publishedContent: null,
        tenant: { name: 'Salon Heart' },
      };

      mockPrisma.salonWebsite.findUnique.mockResolvedValue(mockWeb);
      mockPrisma.salonWebsite.update.mockResolvedValue({
        ...mockWeb,
        publishedContent: draft,
        isPublished: true,
        status: WebsiteStatus.PUBLISHED,
      });

      await service.publishWebsite(tenantId);
      expect(mockPrisma.salonWebsite.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            publishedContent: draft,
            isPublished: true,
            status: WebsiteStatus.PUBLISHED,
          }),
        }),
      );
    });

    it('unpublishWebsite marks website status as DRAFT and isPublished false', async () => {
      mockPrisma.salonWebsite.update.mockResolvedValueOnce({
        isPublished: false,
        status: WebsiteStatus.DRAFT,
      });

      const mockWeb = {
        id: 'web-1',
        tenantId,
        subdomain: 'salon-heart',
        isPublished: false,
        status: WebsiteStatus.DRAFT,
        previewToken: 'tok123',
        draftContent: {},
        publishedContent: {},
        tenant: { name: 'Salon Heart' },
      };
      mockPrisma.salonWebsite.findUnique.mockResolvedValue(mockWeb);

      await service.unpublishWebsite(tenantId);
      expect(mockPrisma.salonWebsite.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { tenantId },
          data: { isPublished: false, status: WebsiteStatus.DRAFT },
        }),
      );
    });

    it('resetDraft restores draftContent from publishedContent', async () => {
      mockPrisma.salonWebsite.findUnique.mockResolvedValue({
        id: 'web-1',
        tenantId,
        subdomain: 'salon-heart',
        previewToken: 'tok123',
        publishedContent: { branding: { title: 'Live Title' } },
        draftContent: { branding: { title: 'Modified Draft Title' } },
        tenant: { name: 'Salon Heart' },
      });

      mockPrisma.salonWebsite.update.mockResolvedValueOnce({
        id: 'web-1',
        tenantId,
        subdomain: 'salon-heart',
        previewToken: 'tok123',
        publishedContent: { branding: { title: 'Live Title' } },
        draftContent: { branding: { title: 'Live Title' } },
        tenant: { name: 'Salon Heart' },
      });

      await service.resetDraft(tenantId);
      expect(mockPrisma.salonWebsite.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { tenantId },
          data: {
            draftContent: { branding: { title: 'Live Title' } },
          },
        }),
      );
    });
  });

  describe('updateWebsite', () => {
    it('throws BadRequestException if subdomain is a reserved system keyword', async () => {
      mockPrisma.salonWebsite.findUnique.mockResolvedValueOnce({
        id: 'web-1',
        tenantId,
        subdomain: 'salon-heart',
        previewToken: 'tok123',
        draftContent: {},
        tenant: { name: 'Salon Heart' },
      });

      await expect(
        service.updateWebsite(tenantId, { subdomain: 'admin' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws ConflictException if subdomain is already taken by another salon', async () => {
      mockPrisma.salonWebsite.findUnique.mockResolvedValueOnce({
        id: 'web-1',
        tenantId,
        subdomain: 'salon-heart',
        previewToken: 'tok123',
        draftContent: {},
        tenant: { name: 'Salon Heart' },
      });

      mockPrisma.salonWebsite.findFirst.mockResolvedValueOnce({
        id: 'other-web',
        tenantId: 'other-tenant',
        subdomain: 'taken-subdomain',
      });

      await expect(
        service.updateWebsite(tenantId, { subdomain: 'taken-subdomain' }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('resolveWebsite', () => {
    it('throws BadRequestException if neither hostname nor subdomain is passed', async () => {
      await expect(service.resolveWebsite({})).rejects.toThrow(BadRequestException);
    });

    it('throws NotFoundException if no website matches', async () => {
      mockPrisma.salonWebsite.findFirst.mockResolvedValueOnce(null);
      await expect(service.resolveWebsite({ subdomain: 'non-existent' })).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws ForbiddenException if salon tenant is inactive', async () => {
      mockPrisma.salonWebsite.findFirst.mockResolvedValueOnce({
        id: 'web-1',
        tenantId,
        subdomain: 'inactive-salon',
        tenant: { status: 'SUSPENDED' },
      });

      await expect(service.resolveWebsite({ subdomain: 'inactive-salon' })).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('throws ForbiddenException if salon does not have WEBSITE or ADVANCED_BOOKING feature', async () => {
      mockPrisma.salonWebsite.findFirst.mockResolvedValueOnce({
        id: 'web-1',
        tenantId,
        subdomain: 'basic-salon',
        tenant: { status: 'ACTIVE' },
      });

      mockSubscriptionFeatureService.hasFeature.mockResolvedValue(false);

      await expect(service.resolveWebsite({ subdomain: 'basic-salon' })).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('successfully resolves website when tenant is active and entitled', async () => {
      mockPrisma.salonWebsite.findFirst.mockResolvedValueOnce({
        id: 'web-1',
        tenantId,
        subdomain: 'salon-heart',
        customDomain: null,
        title: 'Salon Heart',
        status: WebsiteStatus.PUBLISHED,
        isPublished: true,
        templateId: 'luxury-bridal',
        tenant: { status: 'ACTIVE', name: 'Salon Heart' },
      });

      mockSubscriptionFeatureService.hasFeature.mockImplementation(
        (_tid: string, featureCode: string) => {
          if (featureCode === 'WEBSITE') return Promise.resolve(true);
          return Promise.resolve(false);
        },
      );

      const result = await service.resolveWebsite({ subdomain: 'salon-heart' });
      expect(result.found).toBe(true);
      expect(result.subdomain).toBe('salon-heart');
      expect(result.status).toBe(WebsiteStatus.PUBLISHED);
      expect(result.templateId).toBe('luxury-bridal');
    });
  });

  describe('getPublicWebsiteData', () => {
    it('returns sanitized public website data including branches and services for published site', async () => {
      mockPrisma.salonWebsite.findFirst.mockResolvedValueOnce({
        id: 'web-1',
        tenantId,
        schemaName,
        subdomain: 'salon-heart',
        customDomain: null,
        title: 'Salon Heart',
        tagline: 'Luxury Hair Care',
        description: 'Best salon in town',
        themeColor: '#7C3AED',
        logoUrl: 'https://example.com/logo.png',
        bannerUrl: null,
        status: WebsiteStatus.PUBLISHED,
        isPublished: true,
        templateId: 'modern-beauty',
        publishedContent: {
          branding: { title: 'Salon Heart Published', themeColor: '#7C3AED' },
        },
        draftContent: {
          branding: { title: 'Salon Heart Draft', themeColor: '#7C3AED' },
        },
        contactPhone: '0771122334',
        contactEmail: 'heart@salon.lk',
        address: 'Colombo 03',
        socialLinks: { instagram: 'https://instagram.com/salonheart' },
        seoTitle: 'Salon Heart',
        seoDescription: 'Visit us today',
        seoKeywords: 'salon, hair',
        ogImageUrl: null,
        tenant: {
          id: tenantId,
          name: 'Salon Heart',
          code: 'SLN001',
          status: 'ACTIVE',
          logoUrl: 'https://example.com/logo.png',
          primaryColor: '#7C3AED',
          phone: '0771122334',
          email: 'heart@salon.lk',
        },
      });

      mockSubscriptionFeatureService.hasFeature.mockImplementation(
        (_tid: string, featureCode: string) => {
          if (featureCode === 'WEBSITE') return Promise.resolve(true);
          if (featureCode === 'ADVANCED_BOOKING') return Promise.resolve(true);
          return Promise.resolve(false);
        },
      );

      mockTx.$queryRawUnsafe
        .mockResolvedValueOnce([
          { id: 'b-1', name: 'Main Branch', phone: '0771122334', email: 'main@salon.lk', address: 'Colombo 03', isMain: true },
        ])
        .mockResolvedValueOnce([
          { id: 's-1', code: 'SRV-01', name: 'Hair Cut', description: 'Styling', price: 3500, durationMinutes: 45, categoryName: 'Hair' },
        ]);

      const result = await service.getPublicWebsiteData({ subdomain: 'salon-heart' });
      expect(result.website.title).toBe('Salon Heart Published');
      expect(result.branches.length).toBe(1);
      expect(result.featuredServices.length).toBe(1);
      expect(result.features.hasAdvancedBooking).toBe(true);
      expect(result.isPreview).toBe(false);
    });

    it('serves draftContent when preview=true with valid token', async () => {
      mockPrisma.salonWebsite.findFirst.mockResolvedValueOnce({
        id: 'web-1',
        tenantId,
        schemaName,
        subdomain: 'salon-heart',
        customDomain: null,
        title: 'Salon Heart',
        status: WebsiteStatus.DRAFT,
        isPublished: false,
        templateId: 'luxury-bridal',
        previewToken: 'secret-token-123',
        publishedContent: null,
        draftContent: {
          branding: { title: 'Draft Preview Brand', themeColor: '#D97706' },
        },
        tenant: {
          id: tenantId,
          name: 'Salon Heart',
          code: 'SLN001',
          status: 'ACTIVE',
        },
      });

      mockSubscriptionFeatureService.hasFeature.mockResolvedValue(true);
      mockTx.$queryRawUnsafe.mockResolvedValue([]);

      const result = await service.getPublicWebsiteData({
        subdomain: 'salon-heart',
        preview: 'true',
        token: 'secret-token-123',
      });

      expect(result.isPreview).toBe(true);
      expect(result.website.title).toBe('Draft Preview Brand');
    });

    it('rejects draft preview when token is missing or invalid', async () => {
      mockPrisma.salonWebsite.findFirst.mockResolvedValueOnce({
        id: 'web-1',
        tenantId,
        schemaName,
        subdomain: 'salon-heart',
        status: WebsiteStatus.DRAFT,
        isPublished: false,
        previewToken: 'secret-token-123',
        tenant: { status: 'ACTIVE' },
      });

      mockSubscriptionFeatureService.hasFeature.mockResolvedValue(true);

      await expect(
        service.getPublicWebsiteData({
          subdomain: 'salon-heart',
          preview: 'true',
          token: 'wrong-token',
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('rejects unpublished site for normal live visitor', async () => {
      mockPrisma.salonWebsite.findFirst.mockResolvedValueOnce({
        id: 'web-1',
        tenantId,
        schemaName,
        subdomain: 'salon-heart',
        status: WebsiteStatus.DRAFT,
        isPublished: false,
        tenant: { status: 'ACTIVE' },
      });

      mockSubscriptionFeatureService.hasFeature.mockResolvedValue(true);

      await expect(service.getPublicWebsiteData({ subdomain: 'salon-heart' })).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
