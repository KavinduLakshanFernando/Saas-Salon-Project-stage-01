import {
  IsArray,
  IsBoolean,
  IsEmail,
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export const RESERVED_SUBDOMAINS = [
  'www',
  'api',
  'app',
  'admin',
  'superadmin',
  'super-admin',
  'mail',
  'smtp',
  'billing',
  'dashboard',
  'auth',
  'login',
  'signup',
  'register',
  'static',
  'assets',
  'cdn',
  'dev',
  'stage',
  'staging',
  'test',
  'demo',
] as const;

export const SUPPORTED_TEMPLATES = [
  'modern-beauty',
  'luxury-bridal',
  'spa-wellness',
] as const;

export type SupportedTemplateId = (typeof SUPPORTED_TEMPLATES)[number];

export class BrandingConfigDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  tagline?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  @Matches(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, {
    message: 'themeColor must be a valid hex color code (e.g. #7C3AED)',
  })
  themeColor?: string;

  @IsOptional()
  @IsString()
  secondaryColor?: string;

  @IsOptional()
  @IsString()
  logoUrl?: string;

  @IsOptional()
  @IsString()
  bannerUrl?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  heroImages?: string[];
}

export class HeroConfigDto {
  @IsOptional()
  @IsString()
  badgeText?: string;

  @IsOptional()
  @IsString()
  headline?: string;

  @IsOptional()
  @IsString()
  subheadline?: string;

  @IsOptional()
  @IsString()
  heroImageUrl?: string;

  @IsOptional()
  @IsString()
  ctaText?: string;

  @IsOptional()
  @IsString()
  ctaLink?: string;

  @IsOptional()
  @IsString()
  secondaryCtaText?: string;

  @IsOptional()
  @IsString()
  secondaryCtaLink?: string;
}

export class AboutHighlightDto {
  @IsString()
  title: string;

  @IsString()
  description: string;

  @IsOptional()
  @IsString()
  icon?: string;
}

export class AboutConfigDto {
  @IsOptional()
  @IsString()
  heading?: string;

  @IsOptional()
  @IsString()
  subheading?: string;

  @IsOptional()
  @IsString()
  story?: string;

  @IsOptional()
  @IsString()
  quote?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AboutHighlightDto)
  highlights?: AboutHighlightDto[];
}

export class ServicesConfigDto {
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  featuredServiceCodes?: string[];

  @IsOptional()
  @IsBoolean()
  showPricing?: boolean;

  @IsOptional()
  @IsBoolean()
  showDuration?: boolean;
}

export class GalleryPhotoDto {
  @IsString()
  url: string;

  @IsOptional()
  @IsString()
  caption?: string;

  @IsOptional()
  @IsString()
  category?: string;
}

export class ContactConfigDto {
  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @ValidateIf((o) => Boolean(o.email && o.email.trim()))
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  workingHours?: string;

  @IsOptional()
  @IsString()
  googleMapsEmbedUrl?: string;
}

export class SocialLinksDto {
  @IsOptional()
  @IsString()
  facebook?: string;

  @IsOptional()
  @IsString()
  instagram?: string;

  @IsOptional()
  @IsString()
  whatsapp?: string;

  @IsOptional()
  @IsString()
  tiktok?: string;

  @IsOptional()
  @IsString()
  youtube?: string;
}

export class SeoConfigDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  keywords?: string;

  @IsOptional()
  @IsString()
  ogImageUrl?: string;
}

export class SaveDraftWebsiteDto {
  @IsOptional()
  @IsString()
  @IsIn(SUPPORTED_TEMPLATES as unknown as string[], {
    message: 'templateId must be modern-beauty, luxury-bridal, or spa-wellness',
  })
  templateId?: SupportedTemplateId;

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => BrandingConfigDto)
  branding?: BrandingConfigDto;

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => HeroConfigDto)
  hero?: HeroConfigDto;

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => AboutConfigDto)
  about?: AboutConfigDto;

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => ServicesConfigDto)
  servicesConfig?: ServicesConfigDto;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => GalleryPhotoDto)
  gallery?: GalleryPhotoDto[];

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => ContactConfigDto)
  contact?: ContactConfigDto;

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => SocialLinksDto)
  socialLinks?: SocialLinksDto;

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => SeoConfigDto)
  seo?: SeoConfigDto;
}

export class UpdateSalonWebsiteDto {
  @IsOptional()
  @IsString()
  @IsIn(SUPPORTED_TEMPLATES as unknown as string[])
  templateId?: SupportedTemplateId;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(255)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  tagline?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  @Matches(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, {
    message: 'themeColor must be a valid hex color code (e.g. #7C3AED)',
  })
  themeColor?: string;

  @IsOptional()
  @IsString()
  logoUrl?: string;

  @IsOptional()
  @IsString()
  bannerUrl?: string;

  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(63)
  @Matches(/^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/, {
    message: 'Subdomain must contain only lowercase letters, numbers, and hyphens, and cannot start or end with a hyphen',
  })
  subdomain?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  customDomain?: string;

  @IsOptional()
  @IsString()
  contactPhone?: string;

  @IsOptional()
  @ValidateIf((o) => Boolean(o.contactEmail && o.contactEmail.trim()))
  @IsEmail()
  contactEmail?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsObject()
  socialLinks?: Record<string, string>;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  seoTitle?: string;

  @IsOptional()
  @IsString()
  seoDescription?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  seoKeywords?: string;

  @IsOptional()
  @IsString()
  ogImageUrl?: string;
}

export class PublishSalonWebsiteDto {
  @IsBoolean()
  isPublished: boolean;
}

export class ResolveWebsiteQueryDto {
  @IsOptional()
  @IsString()
  hostname?: string;

  @IsOptional()
  @IsString()
  subdomain?: string;

  @IsOptional()
  @IsString()
  preview?: string;

  @IsOptional()
  @IsString()
  token?: string;
}
