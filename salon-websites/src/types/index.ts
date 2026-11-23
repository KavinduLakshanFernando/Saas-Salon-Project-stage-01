export type SupportedTemplateId = 'modern-beauty' | 'luxury-bridal' | 'spa-wellness';

export interface WebsiteBrandingConfig {
  title: string;
  tagline?: string;
  description?: string;
  themeColor: string;
  secondaryColor?: string;
  logoUrl?: string;
  bannerUrl?: string;
  heroImages?: string[];
}

export interface WebsiteHeroConfig {
  badgeText?: string;
  headline?: string;
  subheadline?: string;
  heroImageUrl?: string;
  ctaText?: string;
  ctaLink?: string;
  secondaryCtaText?: string;
  secondaryCtaLink?: string;
}

export interface AboutHighlight {
  title: string;
  description: string;
  icon?: string;
}

export interface WebsiteAboutConfig {
  heading?: string;
  subheading?: string;
  story?: string;
  quote?: string;
  highlights?: AboutHighlight[];
}

export interface WebsiteServicesConfig {
  featuredServiceCodes?: string[];
  showPricing?: boolean;
  showDuration?: boolean;
}

export interface GalleryPhoto {
  url: string;
  caption?: string;
  category?: string;
}

export interface WebsiteContactConfig {
  phone?: string;
  email?: string;
  address?: string;
  workingHours?: string;
  googleMapsEmbedUrl?: string;
}

export interface WebsiteSocialLinks {
  facebook?: string;
  instagram?: string;
  whatsapp?: string;
  tiktok?: string;
  youtube?: string;
}

export interface WebsiteSeoConfig {
  title?: string;
  description?: string;
  keywords?: string;
  ogImageUrl?: string;
}

export interface WebsiteStructuredContent {
  templateId: SupportedTemplateId;
  branding: WebsiteBrandingConfig;
  hero: WebsiteHeroConfig;
  about: WebsiteAboutConfig;
  servicesConfig: WebsiteServicesConfig;
  gallery: GalleryPhoto[];
  contact: WebsiteContactConfig;
  socialLinks: WebsiteSocialLinks;
  seo: WebsiteSeoConfig;
}

export interface SalonWebsite {
  id: string;
  subdomain: string;
  customDomain: string | null;
  templateId?: SupportedTemplateId;
  title: string;
  tagline: string | null;
  description: string | null;
  themeColor: string;
  logoUrl: string | null;
  bannerUrl: string | null;
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
  isPublished: boolean;
  contactPhone: string | null;
  contactEmail: string | null;
  address: string | null;
  socialLinks: Record<string, string> | null;
  seoTitle: string | null;
  seoDescription: string | null;
  seoKeywords: string | null;
  ogImageUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SalonTenant {
  id: string;
  name: string;
  code: string;
  logoUrl: string | null;
  primaryColor: string | null;
  phone: string | null;
  email: string | null;
}

export interface BranchItem {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  isMain: boolean;
}

export interface ServiceItem {
  id: string;
  code: string;
  name: string;
  description: string | null;
  price: number;
  durationMinutes: number;
  categoryName: string | null;
}

export interface WebsiteFeatureFlags {
  hasAdvancedBooking: boolean;
  hasRentals: boolean;
}

export interface PublicWebsitePayload {
  website: SalonWebsite;
  salon: SalonTenant;
  branches: BranchItem[];
  featuredServices: ServiceItem[];
  templateId: SupportedTemplateId;
  content: WebsiteStructuredContent;
  isPreview: boolean;
  features: WebsiteFeatureFlags;
}
