import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  forwardRef,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'crypto';
import { PrismaService } from '../../database/prisma.service';
import { TenantSchemaService } from '../../tenant/services/tenant-schema.service';
import { tenantTable } from '../../tenant/utils/schema-name.util';
import { SubscriptionFeatureService } from '../../subscriptions/subscription-feature.service';
import { StorageService } from '../../common/storage/storage.service';
import {
  RESERVED_SUBDOMAINS,
  SUPPORTED_TEMPLATES,
  SupportedTemplateId,
  UpdateSalonWebsiteDto,
  SaveDraftWebsiteDto,
  ResolveWebsiteQueryDto,
} from './dto/website.dto';
import { Prisma, WebsiteStatus } from '@prisma/client';

export interface PublicWebsiteBranch {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  isMain: boolean;
}

export interface PublicWebsiteServiceItem {
  id: string;
  code: string;
  name: string;
  description: string | null;
  price: number;
  durationMinutes: number;
  categoryName: string | null;
}

export interface WebsiteTemplateInfo {
  id: SupportedTemplateId;
  name: string;
  tagline: string;
  description: string;
  category: string;
  previewThumbnail: string;
  defaultThemeColor: string;
  defaultSecondaryColor: string;
  idealFor: string;
  features: string[];
}

export const AVAILABLE_TEMPLATES: WebsiteTemplateInfo[] = [
  {
    id: 'modern-beauty',
    name: 'Modern Beauty Salon',
    tagline: 'Sleek, vibrant, and contemporary styling aesthetic',
    description:
      'A high-energy, modern chic layout with bold typography, dynamic service category filter tabs, high-contrast price tags, and floating quick-booking actions.',
    category: 'Hair, Nails & Beauty',
    previewThumbnail: '/templates/modern-beauty.png',
    defaultThemeColor: '#7C3AED',
    defaultSecondaryColor: '#EC4899',
    idealFor: 'Urban hair salons, modern nail bars, unisex styling studios, and beauty bars.',
    features: [
      'Bold hero headline with status badges',
      'Interactive categorized service menu',
      'Stylist trust highlights & hygiene guarantee',
      'Floating quick-action phone & WhatsApp bar',
    ],
  },
  {
    id: 'luxury-bridal',
    name: 'Luxury Bridal Salon',
    tagline: 'Opulent, editorial bridal high-fashion showcase',
    description:
      'Editorial luxury high-end bridal layout featuring Playfair-inspired serif headers, warm champagne and rose-gold accents, bridal trial highlights, and a curated wedding mood board.',
    category: 'Bridal, Dressing & Couture',
    previewThumbnail: '/templates/luxury-bridal.png',
    defaultThemeColor: '#D97706',
    defaultSecondaryColor: '#BE185D',
    idealFor: 'Bridal dressing salons, high-end couture stylists, wedding hair & makeup specialists.',
    features: [
      'Editorial split-hero with romantic framing',
      'Bridal packages, trial sessions, and attire showcase',
      'Curated wedding & bridal mood board gallery',
      'Client love notes & bespoke consultation bookings',
    ],
  },
  {
    id: 'spa-wellness',
    name: 'Spa & Wellness Salon',
    tagline: 'Serene, organic tranquility & restorative care',
    description:
      'A calming sanctuary layout with earthy herbal palettes, mindful minimalism, treatment ritual steps (Arrival, Sensory Therapy, Renewal), and organic botanical ingredients.',
    category: 'Spa, Wellness & Therapy',
    previewThumbnail: '/templates/spa-wellness.png',
    defaultThemeColor: '#059669',
    defaultSecondaryColor: '#0284C7',
    idealFor: 'Day spas, wellness retreats, Ayurvedic centers, aromatherapy & skin therapy salons.',
    features: [
      'Calming minimalist aesthetic with botanical motifs',
      'Treatment rituals journey timeline',
      'Therapeutic benefits and natural ingredient highlights',
      'Relaxing ambiance gallery & wellness consultation CTA',
    ],
  },
];

export interface PublicWebsitePayload {
  website: {
    id: string;
    subdomain: string;
    customDomain: string | null;
    title: string;
    tagline: string | null;
    description: string | null;
    themeColor: string;
    logoUrl: string | null;
    bannerUrl: string | null;
    status: WebsiteStatus;
    isPublished: boolean;
    contactPhone: string | null;
    contactEmail: string | null;
    address: string | null;
    socialLinks: Record<string, string> | null;
    seoTitle: string | null;
    seoDescription: string | null;
    seoKeywords: string | null;
    ogImageUrl: string | null;
  };
  salon: {
    id: string;
    name: string;
    code: string;
    logoUrl: string | null;
    primaryColor: string | null;
    phone: string | null;
    email: string | null;
  };
  branches: PublicWebsiteBranch[];
  featuredServices: PublicWebsiteServiceItem[];
  templateId: SupportedTemplateId;
  content: any;
  isPreview: boolean;
  features: {
    hasAdvancedBooking: boolean;
    hasRentals: boolean;
  };
}

@Injectable()
export class WebsitesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantSchemaService: TenantSchemaService,
    private readonly configService: ConfigService,
    private readonly storageService: StorageService,
    @Inject(forwardRef(() => SubscriptionFeatureService))
    private readonly subscriptionFeatureService: SubscriptionFeatureService,
  ) {}

  /**
   * Slugify a name or code to a clean subdomain
   */
  private slugifySubdomain(input: string): string {
    let clean = input
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9-]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');

    if (clean.length < 3) {
      clean = `salon-${clean}`;
    }

    if (clean.length > 63) {
      clean = clean.slice(0, 63).replace(/-$/, '');
    }

    if (RESERVED_SUBDOMAINS.includes(clean as any)) {
      clean = `salon-${clean}`;
    }

    return clean;
  }

  /**
   * Generate default structured content for a salon website
   */
  private buildDefaultContent(params: {
    title: string;
    tagline?: string | null;
    description?: string | null;
    themeColor?: string | null;
    phone?: string | null;
    email?: string | null;
    address?: string | null;
    logoUrl?: string | null;
    templateId?: SupportedTemplateId;
  }) {
    const templateId = params.templateId || 'modern-beauty';
    const templateInfo =
      AVAILABLE_TEMPLATES.find((t) => t.id === templateId) || AVAILABLE_TEMPLATES[0];

    const themeColor = params.themeColor || templateInfo.defaultThemeColor;
    const secondaryColor = templateInfo.defaultSecondaryColor;

    return {
      templateId,
      branding: {
        title: params.title,
        tagline: params.tagline || `Experience elegance & personalized beauty at ${params.title}`,
        description:
          params.description ||
          `Premium salon treatments, contemporary styling, and rejuvenating care tailored to your unique lifestyle.`,
        themeColor,
        secondaryColor,
        logoUrl: params.logoUrl || null,
        bannerUrl: null,
        heroImages: [],
      },
      hero: {
        badgeText:
          templateId === 'luxury-bridal'
            ? 'Haute Couture Bridal & Styling'
            : templateId === 'spa-wellness'
            ? 'Holistic Wellness & Sanctuary'
            : 'Premium Hair, Beauty & Grooming',
        headline: params.title,
        subheadline:
          params.tagline ||
          (templateId === 'luxury-bridal'
            ? 'Creating breathtaking bridal looks and timeless elegance for your most cherished moments.'
            : templateId === 'spa-wellness'
            ? 'Restore balance, revitalize your skin, and immerse yourself in soothing, restorative treatments.'
            : 'Discover exceptional hair styling, vibrant color, and personalized beauty care.'),
        ctaText:
          templateId === 'luxury-bridal'
            ? 'Book Bridal Consultation'
            : templateId === 'spa-wellness'
            ? 'Explore Spa Rituals'
            : 'View Services & Pricing',
        ctaLink: '#services',
        secondaryCtaText: 'Contact Us',
        secondaryCtaLink: '#contact',
      },
      about: {
        heading:
          templateId === 'luxury-bridal'
            ? 'Dedicated to Bridal Perfection'
            : templateId === 'spa-wellness'
            ? 'Your Sanctuary for Mind & Body'
            : 'Passionate About Bringing Out Your Best Look',
        subheading: 'Crafted with passion, skill, and exceptional attention to detail.',
        story: `At ${params.title}, our team of certified professionals is committed to delivering an extraordinary salon experience. We combine contemporary techniques with premium products to ensure every client leaves feeling renewed and radiant.`,
        quote:
          templateId === 'luxury-bridal'
            ? 'Every bride deserves to feel like royalty on her special day.'
            : templateId === 'spa-wellness'
            ? 'True wellness begins when body, mind, and spirit are in perfect harmony.'
            : 'We dont just style hair — we build confidence and lasting relationships.',
        highlights: [
          {
            title: 'Certified Stylists',
            description: 'Master stylists continuously trained in contemporary trends.',
            icon: 'award',
          },
          {
            title: '100% Hygienic Care',
            description: 'Hospital-grade sterilization for all tools and stations.',
            icon: 'shield-check',
          },
          {
            title: 'Premium Products',
            description: 'Top-tier cruelty-free, professional-grade styling lines.',
            icon: 'sparkles',
          },
        ],
      },
      servicesConfig: {
        featuredServiceCodes: [],
        showPricing: true,
        showDuration: true,
      },
      gallery: [],
      contact: {
        phone: params.phone || '',
        email: params.email || '',
        address: params.address || '',
        workingHours: 'Monday – Sunday: 9:00 AM – 7:30 PM',
        googleMapsEmbedUrl: '',
      },
      socialLinks: {
        facebook: '',
        instagram: '',
        whatsapp: params.phone ? `https://wa.me/${params.phone.replace(/[^0-9]/g, '')}` : '',
        tiktok: '',
        youtube: '',
      },
      seo: {
        title: `${params.title} | Official Salon Website`,
        description: `Explore services, view pricing, and find branch directions for ${params.title}.`,
        keywords: 'salon, hair, beauty, bridal, makeup, grooming, styling',
        ogImageUrl: '',
      },
    };
  }

  /**
   * Automatically provision a draft website for a tenant.
   * Idempotent: Never creates duplicate websites.
   */
  async provisionDraftWebsite(tenantId: string) {
    const existing = await this.prisma.salonWebsite.findUnique({
      where: { tenantId },
    });

    if (existing) {
      return existing;
    }

    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
    });

    if (!tenant) {
      throw new NotFoundException(`Tenant with id ${tenantId} not found`);
    }

    // Generate unique subdomain
    let baseSubdomain = this.slugifySubdomain(tenant.code || tenant.name);
    let candidate = baseSubdomain;
    let suffix = 1;

    while (await this.prisma.salonWebsite.findUnique({ where: { subdomain: candidate } })) {
      candidate = `${baseSubdomain}-${suffix++}`;
    }

    // Look up primary branch address / phone if available
    let branchPhone = tenant.phone;
    let branchEmail = tenant.email;
    let branchAddress: string | null = null;

    try {
      const branches = tenantTable(tenant.schemaName, 'branches');
      const branchRows = await this.tenantSchemaService.withTenantSchema(
        tenant.schemaName,
        async ({ tx }) => {
          return tx.$queryRawUnsafe<
            Array<{ phone: string | null; email: string | null; address: string | null; is_main: boolean }>
          >(
            `SELECT phone, email, address, is_main FROM ${branches} WHERE status = 'ACTIVE' ORDER BY is_main DESC, created_at ASC LIMIT 1`,
          );
        },
      );

      if (branchRows.length > 0) {
        if (branchRows[0].phone) branchPhone = branchRows[0].phone;
        if (branchRows[0].email) branchEmail = branchRows[0].email;
        if (branchRows[0].address) branchAddress = branchRows[0].address;
      }
    } catch {
      // Schema may be provisioning or empty
    }

    const previewToken = randomBytes(24).toString('hex');
    const defaultContent = this.buildDefaultContent({
      title: tenant.name,
      tagline: `Welcome to ${tenant.name}`,
      description: `Experience exceptional hair styling, beauty, and personalized salon care at ${tenant.name}.`,
      themeColor: tenant.primaryColor || '#7C3AED',
      phone: branchPhone,
      email: branchEmail,
      address: branchAddress,
      logoUrl: tenant.logoUrl,
      templateId: 'modern-beauty',
    });

    return this.prisma.salonWebsite.create({
      data: {
        tenantId: tenant.id,
        schemaName: tenant.schemaName,
        subdomain: candidate,
        templateId: 'modern-beauty',
        draftContent: defaultContent as any,
        publishedContent: Prisma.JsonNull,
        previewToken,
        title: tenant.name,
        tagline: `Welcome to ${tenant.name}`,
        description: `Experience exceptional hair styling, beauty, and personalized salon care at ${tenant.name}.`,
        themeColor: tenant.primaryColor || '#7C3AED',
        logoUrl: tenant.logoUrl || null,
        status: WebsiteStatus.DRAFT,
        isPublished: false,
        contactPhone: branchPhone || null,
        contactEmail: branchEmail || null,
        address: branchAddress,
        seoTitle: `${tenant.name} | Official Salon Website`,
        seoDescription: `Explore our services, book appointments, and find directions to ${tenant.name}.`,
      },
    });
  }

  /**
   * Get available templates metadata
   */
  getAvailableTemplates(): WebsiteTemplateInfo[] {
    return AVAILABLE_TEMPLATES;
  }

  /**
   * Helper to format live and preview URLs
   */
  private getWebsiteUrls(website: { subdomain: string; customDomain?: string | null; previewToken?: string | null }) {
    const isProduction = this.configService.get<string>('NODE_ENV') === 'production';
    const platformDomain = this.configService.get<string>('PLATFORM_DOMAIN', 'localhost');
    const websitesPort = this.configService.get<string>('WEBSITES_PORT', '3002');

    let publishedUrl: string;
    let previewUrl: string;

    if (!isProduction) {
      publishedUrl = `http://localhost:${websitesPort}/?subdomain=${website.subdomain}`;
      previewUrl = `http://localhost:${websitesPort}/?subdomain=${website.subdomain}&preview=true&token=${website.previewToken || ''}`;
    } else {
      publishedUrl = website.customDomain
        ? `https://${website.customDomain}`
        : `https://${website.subdomain}.${platformDomain}`;
      previewUrl = `${publishedUrl}?preview=true&token=${website.previewToken || ''}`;
    }

    return { publishedUrl, previewUrl };
  }

  /**
   * Get salon website record for tenant admin with draft & published state
   */
  async getWebsite(tenantId: string) {
    let website = await this.prisma.salonWebsite.findUnique({
      where: { tenantId },
      include: {
        tenant: {
          select: {
            id: true,
            name: true,
            code: true,
            phone: true,
            email: true,
            logoUrl: true,
            primaryColor: true,
          },
        },
      },
    });

    if (!website) {
      website = (await this.provisionDraftWebsite(tenantId)) as any;
      website = await this.prisma.salonWebsite.findUnique({
        where: { tenantId },
        include: {
          tenant: {
            select: {
              id: true,
              name: true,
              code: true,
              phone: true,
              email: true,
              logoUrl: true,
              primaryColor: true,
            },
          },
        },
      });
    }

    if (!website) {
      throw new NotFoundException(`Website not found for tenant ${tenantId}`);
    }

    // Ensure previewToken exists
    let previewToken = website.previewToken;
    let draftContent = website.draftContent as any;

    let needsUpdate = false;
    const updateData: any = {};

    if (!previewToken) {
      previewToken = randomBytes(24).toString('hex');
      updateData.previewToken = previewToken;
      needsUpdate = true;
    }

    if (!draftContent) {
      draftContent = this.buildDefaultContent({
        title: website.title,
        tagline: website.tagline,
        description: website.description,
        themeColor: website.themeColor,
        phone: website.contactPhone,
        email: website.contactEmail,
        address: website.address,
        logoUrl: website.logoUrl,
        templateId: (website.templateId as SupportedTemplateId) || 'modern-beauty',
      });
      updateData.draftContent = draftContent;
      needsUpdate = true;
    }

    if (needsUpdate) {
      website = await this.prisma.salonWebsite.update({
        where: { tenantId },
        data: updateData,
        include: {
          tenant: {
            select: {
              id: true,
              name: true,
              code: true,
              phone: true,
              email: true,
              logoUrl: true,
              primaryColor: true,
            },
          },
        },
      });
      draftContent = website.draftContent;
      previewToken = website.previewToken;
    }

    const { publishedUrl, previewUrl } = this.getWebsiteUrls({
      subdomain: website.subdomain,
      customDomain: website.customDomain,
      previewToken,
    });

    // Check if draft has unpublished changes
    const hasUnpublishedChanges =
      !website.publishedContent ||
      JSON.stringify(draftContent) !== JSON.stringify(website.publishedContent);

    return {
      ...website,
      draftContent,
      publishedContent: website.publishedContent,
      publishedUrl,
      previewUrl,
      hasUnpublishedChanges,
    };
  }

  /**
   * Save website draft content (does NOT affect the live published site)
   */
  async saveDraft(tenantId: string, dto: SaveDraftWebsiteDto) {
    const existing = await this.getWebsite(tenantId);

    // Merge existing draft content with incoming updates
    const currentDraft = (existing.draftContent as any) || {};

    const updatedTemplateId = (dto.templateId || currentDraft.templateId || existing.templateId || 'modern-beauty') as SupportedTemplateId;

    const mergedContent = {
      templateId: updatedTemplateId,
      branding: {
        ...currentDraft.branding,
        ...(dto.branding || {}),
        title: dto.branding?.title?.trim() || currentDraft.branding?.title || existing.title,
        themeColor: dto.branding?.themeColor || currentDraft.branding?.themeColor || existing.themeColor,
      },
      hero: {
        ...currentDraft.hero,
        ...(dto.hero || {}),
      },
      about: {
        ...currentDraft.about,
        ...(dto.about || {}),
      },
      servicesConfig: {
        ...currentDraft.servicesConfig,
        ...(dto.servicesConfig || {}),
      },
      gallery: dto.gallery !== undefined ? dto.gallery : (currentDraft.gallery || []),
      contact: {
        ...currentDraft.contact,
        ...(dto.contact || {}),
      },
      socialLinks: {
        ...currentDraft.socialLinks,
        ...(dto.socialLinks || {}),
      },
      seo: {
        ...currentDraft.seo,
        ...(dto.seo || {}),
      },
    };

    // Update draft content & keep top-level fields in sync for indexing
    const updated = await this.prisma.salonWebsite.update({
      where: { tenantId },
      data: {
        templateId: updatedTemplateId,
        draftContent: mergedContent as any,
        title: mergedContent.branding.title,
        tagline: mergedContent.branding.tagline || null,
        description: mergedContent.branding.description || null,
        themeColor: mergedContent.branding.themeColor || '#7C3AED',
        logoUrl: mergedContent.branding.logoUrl || null,
        bannerUrl: mergedContent.branding.bannerUrl || null,
        contactPhone: mergedContent.contact.phone || null,
        contactEmail: mergedContent.contact.email || null,
        address: mergedContent.contact.address || null,
        socialLinks: mergedContent.socialLinks || null,
        seoTitle: mergedContent.seo.title || null,
        seoDescription: mergedContent.seo.description || null,
        seoKeywords: mergedContent.seo.keywords || null,
        ogImageUrl: mergedContent.seo.ogImageUrl || null,
      },
    });

    return this.getWebsite(tenantId);
  }

  /**
   * Publish website: Copies draft content to published content and marks published
   */
  async publishWebsite(tenantId: string) {
    const existing = await this.getWebsite(tenantId);

    const draft = existing.draftContent;
    if (!draft) {
      throw new BadRequestException('No draft content found to publish');
    }

    const updated = await this.prisma.salonWebsite.update({
      where: { tenantId },
      data: {
        publishedContent: draft as any,
        publishedAt: new Date(),
        isPublished: true,
        status: WebsiteStatus.PUBLISHED,
      },
    });

    return this.getWebsite(tenantId);
  }

  /**
   * Unpublish website: Sets isPublished to false
   */
  async unpublishWebsite(tenantId: string) {
    await this.prisma.salonWebsite.update({
      where: { tenantId },
      data: {
        isPublished: false,
        status: WebsiteStatus.DRAFT,
      },
    });

    return this.getWebsite(tenantId);
  }

  /**
   * Reset draft content to match current published version
   */
  async resetDraft(tenantId: string) {
    const existing = await this.getWebsite(tenantId);

    if (!existing.publishedContent) {
      // Re-synthesize clean baseline
      const defaultContent = this.buildDefaultContent({
        title: existing.title,
        tagline: existing.tagline,
        description: existing.description,
        themeColor: existing.themeColor,
        phone: existing.contactPhone,
        email: existing.contactEmail,
        address: existing.address,
        logoUrl: existing.logoUrl,
        templateId: (existing.templateId as SupportedTemplateId) || 'modern-beauty',
      });

      await this.prisma.salonWebsite.update({
        where: { tenantId },
        data: {
          draftContent: defaultContent as any,
        },
      });
    } else {
      await this.prisma.salonWebsite.update({
        where: { tenantId },
        data: {
          draftContent: existing.publishedContent as any,
        },
      });
    }

    return this.getWebsite(tenantId);
  }

  /**
   * Upload an image (logo, hero banner, or gallery photo) for the website
   */
  async uploadWebsiteImage(
    tenantId: string,
    file: Express.Multer.File | undefined,
    category: 'logo' | 'hero' | 'gallery' = 'gallery',
  ) {
    if (!file || !file.buffer) {
      throw new BadRequestException('No image file provided');
    }

    const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowedMimeTypes.includes(file.mimetype)) {
      throw new BadRequestException('Only JPG, PNG, WEBP, and GIF images are allowed');
    }

    if (file.size > 5 * 1024 * 1024) {
      throw new BadRequestException('File size must not exceed 5MB');
    }

    const ext = file.originalname.split('.').pop()?.toLowerCase() || 'webp';
    const uniqueSuffix = randomBytes(8).toString('hex');
    const filename = `${category}-${Date.now()}-${uniqueSuffix}.${ext}`;

    const folder = `websites/${tenantId}/${category}`;
    const url = await this.storageService.uploadFile(file.buffer, folder, filename, file.mimetype);

    return {
      url,
      filename,
      category,
    };
  }

  /**
   * Update website settings & SEO (top-level config)
   */
  async updateWebsite(tenantId: string, dto: UpdateSalonWebsiteDto) {
    const website = await this.getWebsite(tenantId);

    // Validate subdomain uniqueness if changed
    if (dto.subdomain && dto.subdomain.toLowerCase() !== website.subdomain.toLowerCase()) {
      const cleanSub = dto.subdomain.toLowerCase().trim();
      if (RESERVED_SUBDOMAINS.includes(cleanSub as any)) {
        throw new BadRequestException(`Subdomain "${cleanSub}" is a reserved system keyword`);
      }

      const conflict = await this.prisma.salonWebsite.findFirst({
        where: {
          subdomain: cleanSub,
          tenantId: { not: tenantId },
        },
      });

      if (conflict) {
        throw new ConflictException(`Subdomain "${cleanSub}" is already registered by another salon`);
      }
    }

    // Validate custom domain uniqueness if changed
    if (dto.customDomain) {
      const cleanDomain = dto.customDomain
        .toLowerCase()
        .trim()
        .replace(/^https?:\/\//, '')
        .replace(/\/.*$/, '');

      const domainConflict = await this.prisma.salonWebsite.findFirst({
        where: {
          customDomain: cleanDomain,
          tenantId: { not: tenantId },
        },
      });

      if (domainConflict) {
        throw new ConflictException(`Custom domain "${cleanDomain}" is already in use`);
      }
    }

    await this.prisma.salonWebsite.update({
      where: { tenantId },
      data: {
        templateId: dto.templateId ?? undefined,
        title: dto.title?.trim() ?? undefined,
        tagline: dto.tagline !== undefined ? dto.tagline?.trim() || null : undefined,
        description: dto.description !== undefined ? dto.description?.trim() || null : undefined,
        themeColor: dto.themeColor?.trim() ?? undefined,
        logoUrl: dto.logoUrl !== undefined ? dto.logoUrl?.trim() || null : undefined,
        bannerUrl: dto.bannerUrl !== undefined ? dto.bannerUrl?.trim() || null : undefined,
        subdomain: dto.subdomain ? dto.subdomain.toLowerCase().trim() : undefined,
        customDomain: dto.customDomain !== undefined
          ? dto.customDomain ? dto.customDomain.toLowerCase().trim().replace(/^https?:\/\//, '').replace(/\/.*$/, '') : null
          : undefined,
        contactPhone: dto.contactPhone !== undefined ? dto.contactPhone?.trim() || null : undefined,
        contactEmail: dto.contactEmail !== undefined ? dto.contactEmail?.trim() || null : undefined,
        address: dto.address !== undefined ? dto.address?.trim() || null : undefined,
        socialLinks: dto.socialLinks !== undefined ? dto.socialLinks : undefined,
        seoTitle: dto.seoTitle !== undefined ? dto.seoTitle?.trim() || null : undefined,
        seoDescription: dto.seoDescription !== undefined ? dto.seoDescription?.trim() || null : undefined,
        seoKeywords: dto.seoKeywords !== undefined ? dto.seoKeywords?.trim() || null : undefined,
        ogImageUrl: dto.ogImageUrl !== undefined ? dto.ogImageUrl?.trim() || null : undefined,
      },
    });

    return this.getWebsite(tenantId);
  }

  /**
   * Toggle publish / draft status
   */
  async setPublishStatus(tenantId: string, isPublished: boolean) {
    if (isPublished) {
      return this.publishWebsite(tenantId);
    } else {
      return this.unpublishWebsite(tenantId);
    }
  }

  /**
   * Helper: extract candidate subdomain or domain from hostname or query
   */
  private extractCandidate(query: ResolveWebsiteQueryDto): { subdomain?: string; customDomain?: string } {
    if (query.subdomain?.trim()) {
      return { subdomain: query.subdomain.trim().toLowerCase() };
    }

    if (!query.hostname?.trim()) {
      return {};
    }

    const host = query.hostname.toLowerCase().trim().replace(/:\d+$/, '');

    const parts = host.split('.');
    if (parts.length >= 2) {
      const sub = parts[0];
      return { subdomain: sub, customDomain: host };
    }

    return { customDomain: host };
  }

  /**
   * Public Hostname / Subdomain Resolution API
   */
  async resolveWebsite(query: ResolveWebsiteQueryDto) {
    const { subdomain, customDomain } = this.extractCandidate(query);

    if (!subdomain && !customDomain) {
      throw new BadRequestException('Either hostname or subdomain is required for resolution');
    }

    const whereConditions: any[] = [];
    if (subdomain) whereConditions.push({ subdomain });
    if (customDomain) whereConditions.push({ customDomain });

    const website = await this.prisma.salonWebsite.findFirst({
      where: { OR: whereConditions },
      include: {
        tenant: {
          select: {
            id: true,
            name: true,
            code: true,
            status: true,
            logoUrl: true,
            primaryColor: true,
          },
        },
      },
    });

    if (!website) {
      throw new NotFoundException('Salon website not found for this domain/subdomain');
    }

    if (website.tenant.status !== 'ACTIVE') {
      throw new ForbiddenException('This salon is currently inactive or suspended');
    }

    // Verify SaaS subscription entitlement (WEBSITE or ADVANCED_BOOKING)
    const hasWebsiteEntitlement =
      (await this.subscriptionFeatureService.hasFeature(website.tenantId, 'WEBSITE')) ||
      (await this.subscriptionFeatureService.hasFeature(website.tenantId, 'ADVANCED_BOOKING'));

    if (!hasWebsiteEntitlement) {
      throw new ForbiddenException('Salon website is not included in the current subscription plan');
    }

    return {
      found: true,
      tenantId: website.tenantId,
      subdomain: website.subdomain,
      customDomain: website.customDomain,
      title: website.title,
      status: website.status,
      isPublished: website.isPublished,
      templateId: website.templateId,
      salonName: website.tenant.name,
    };
  }

  /**
   * Public Website Data API (returns full payload for Next.js to render)
   */
  async getPublicWebsiteData(query: ResolveWebsiteQueryDto): Promise<PublicWebsitePayload> {
    const { subdomain, customDomain } = this.extractCandidate(query);

    if (!subdomain && !customDomain) {
      throw new BadRequestException('Either hostname or subdomain is required');
    }

    const whereConditions: any[] = [];
    if (subdomain) whereConditions.push({ subdomain });
    if (customDomain) whereConditions.push({ customDomain });

    const website = await this.prisma.salonWebsite.findFirst({
      where: { OR: whereConditions },
      include: {
        tenant: {
          select: {
            id: true,
            name: true,
            code: true,
            status: true,
            logoUrl: true,
            primaryColor: true,
            phone: true,
            email: true,
          },
        },
      },
    });

    if (!website) {
      throw new NotFoundException('Salon website not found');
    }

    if (website.tenant.status !== 'ACTIVE') {
      throw new ForbiddenException('Salon is currently unavailable');
    }

    const hasWebsiteEntitlement =
      (await this.subscriptionFeatureService.hasFeature(website.tenantId, 'WEBSITE')) ||
      (await this.subscriptionFeatureService.hasFeature(website.tenantId, 'ADVANCED_BOOKING'));

    if (!hasWebsiteEntitlement) {
      throw new ForbiddenException('Salon website is not available under the current subscription');
    }

    // Determine Draft Preview vs Published Live content
    const isPreview = query.preview === 'true';
    const isProduction = this.configService.get<string>('NODE_ENV') === 'production';

    if (isPreview) {
      // Draft preview must be authenticated with valid preview token
      if (website.previewToken) {
        if (!query.token || query.token !== website.previewToken) {
          throw new ForbiddenException('Invalid or missing preview token for draft access');
        }
      }
    } else {
      // Live visitor: Must be published
      if (!website.isPublished) {
        throw new NotFoundException('This salon website is currently in draft mode and not published yet');
      }
    }

    // Active content snapshot
    const activeContent = isPreview
      ? (website.draftContent as any) || website.publishedContent
      : (website.publishedContent as any) || website.draftContent;

    const templateId = (activeContent?.templateId || website.templateId || 'modern-beauty') as SupportedTemplateId;

    // Query active branches in tenant schema (Requirement 13: strictly without exposing schemaName)
    let branchesList: PublicWebsiteBranch[] = [];
    let servicesList: PublicWebsiteServiceItem[] = [];

    try {
      const branchesTable = tenantTable(website.schemaName, 'branches');
      const servicesTable = tenantTable(website.schemaName, 'services');
      const categoriesTable = tenantTable(website.schemaName, 'service_categories');

      const result = await this.tenantSchemaService.withTenantSchema(
        website.schemaName,
        async ({ tx }) => {
          const branches = await tx.$queryRawUnsafe<
            Array<{ id: string; name: string; phone: string | null; email: string | null; address: string | null; isMain: boolean }>
          >(
            `SELECT id, name, phone, email, address, is_main AS "isMain"
             FROM ${branchesTable}
             WHERE status = 'ACTIVE'
             ORDER BY is_main DESC, name ASC`,
          );

          const services = await tx.$queryRawUnsafe<
            Array<{
              id: string;
              code: string;
              name: string;
              description: string | null;
              price: number;
              durationMinutes: number;
              categoryName: string | null;
            }>
          >(
            `SELECT s.id, s.code, s.name, s.description, s.price::float AS price, s.duration_minutes AS "durationMinutes", sc.name AS "categoryName"
             FROM ${servicesTable} s
             LEFT JOIN ${categoriesTable} sc ON sc.id = s.category_id
             WHERE s.is_active = TRUE
             ORDER BY sc.name ASC NULLS LAST, s.name ASC
             LIMIT 30`,
          );

          return { branches, services };
        },
      );

      branchesList = result.branches;
      servicesList = result.services;
    } catch {
      // Graceful fallback if schema tables are pending
    }

    // Check optional features
    const hasAdvancedBooking = await this.subscriptionFeatureService.hasFeature(
      website.tenantId,
      'ADVANCED_BOOKING',
    );
    const hasRentals = await this.subscriptionFeatureService.hasFeature(
      website.tenantId,
      'RENTALS',
    );

    // Apply branding overrides from content if available
    const branding = activeContent?.branding || {};

    return {
      website: {
        id: website.id,
        subdomain: website.subdomain,
        customDomain: website.customDomain,
        title: branding.title || website.title,
        tagline: branding.tagline || website.tagline,
        description: branding.description || website.description,
        themeColor: branding.themeColor || website.themeColor || '#7C3AED',
        logoUrl: branding.logoUrl || website.logoUrl,
        bannerUrl: branding.bannerUrl || website.bannerUrl,
        status: website.status,
        isPublished: website.isPublished,
        contactPhone: activeContent?.contact?.phone || website.contactPhone,
        contactEmail: activeContent?.contact?.email || website.contactEmail,
        address: activeContent?.contact?.address || website.address,
        socialLinks: (activeContent?.socialLinks || website.socialLinks) as Record<string, string> | null,
        seoTitle: activeContent?.seo?.title || website.seoTitle,
        seoDescription: activeContent?.seo?.description || website.seoDescription,
        seoKeywords: activeContent?.seo?.keywords || website.seoKeywords,
        ogImageUrl: activeContent?.seo?.ogImageUrl || website.ogImageUrl,
      },
      salon: {
        id: website.tenant.id,
        name: website.tenant.name,
        code: website.tenant.code,
        logoUrl: website.tenant.logoUrl,
        primaryColor: website.tenant.primaryColor,
        phone: website.tenant.phone,
        email: website.tenant.email,
      },
      branches: branchesList,
      featuredServices: servicesList,
      templateId,
      content: activeContent,
      isPreview,
      features: {
        hasAdvancedBooking,
        hasRentals,
      },
    };
  }
}
