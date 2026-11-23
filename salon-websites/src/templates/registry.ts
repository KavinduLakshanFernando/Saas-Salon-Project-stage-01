import { TemplateDefinition } from './types';
import { ModernBeautyTemplate } from './modern-beauty/ModernBeautyTemplate';
import { LuxuryBridalTemplate } from './luxury-bridal/LuxuryBridalTemplate';
import { SpaWellnessTemplate } from './spa-wellness/SpaWellnessTemplate';
import { SupportedTemplateId } from '@/types';

/**
 * Developer Template Registry
 * Additional website templates can easily be registered here in code.
 */
class TemplateRegistry {
  private templates: Map<SupportedTemplateId, TemplateDefinition> = new Map();

  constructor() {
    this.registerDefaults();
  }

  private registerDefaults() {
    this.register({
      id: 'modern-beauty',
      name: 'Modern Beauty Salon',
      tagline: 'Sleek, vibrant, and contemporary styling aesthetic',
      description:
        'A high-energy, modern chic layout with bold typography, dynamic service category filter tabs, high-contrast price tags, and floating quick-booking actions.',
      category: 'Hair, Nails & Beauty',
      previewThumbnail: '/templates/modern-beauty.png',
      defaultThemeColor: '#7C3AED',
      defaultSecondaryColor: '#EC4899',
      Component: ModernBeautyTemplate,
    });

    this.register({
      id: 'luxury-bridal',
      name: 'Luxury Bridal Salon',
      tagline: 'Opulent, editorial bridal high-fashion showcase',
      description:
        'Editorial luxury high-end bridal layout featuring Playfair-inspired serif headers, warm champagne and rose-gold accents, bridal trial highlights, and a curated wedding mood board.',
      category: 'Bridal, Dressing & Couture',
      previewThumbnail: '/templates/luxury-bridal.png',
      defaultThemeColor: '#D97706',
      defaultSecondaryColor: '#BE185D',
      Component: LuxuryBridalTemplate,
    });

    this.register({
      id: 'spa-wellness',
      name: 'Spa & Wellness Salon',
      tagline: 'Serene, organic tranquility & restorative care',
      description:
        'A calming sanctuary layout with earthy herbal palettes, mindful minimalism, treatment ritual steps (Arrival, Sensory Therapy, Renewal), and organic botanical ingredients.',
      category: 'Spa, Wellness & Therapy',
      previewThumbnail: '/templates/spa-wellness.png',
      defaultThemeColor: '#059669',
      defaultSecondaryColor: '#0284C7',
      Component: SpaWellnessTemplate,
    });
  }

  /**
   * Register a new or custom website template
   */
  public register(template: TemplateDefinition): void {
    this.templates.set(template.id, template);
  }

  /**
   * Retrieve a template by ID (falls back to modern-beauty if not found)
   */
  public get(id?: string | null): TemplateDefinition {
    if (id && this.templates.has(id as SupportedTemplateId)) {
      return this.templates.get(id as SupportedTemplateId)!;
    }
    return this.templates.get('modern-beauty')!;
  }

  /**
   * Get list of all registered templates
   */
  public getAll(): TemplateDefinition[] {
    return Array.from(this.templates.values());
  }

  /**
   * Check if a template ID is valid
   */
  public has(id: string): boolean {
    return this.templates.has(id as SupportedTemplateId);
  }
}

export const templateRegistry = new TemplateRegistry();

