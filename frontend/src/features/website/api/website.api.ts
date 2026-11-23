import api from '@/api/axios';
import type {
  SalonWebsiteEntity,
  WebsiteTemplateInfo,
  WebsiteStructuredContent,
} from '../types/website.types';

export const websiteApi = {
  /**
   * Fetch current salon website settings, draft content, and published content
   */
  getWebsite: async (): Promise<SalonWebsiteEntity> => {
    const res = await api.get<SalonWebsiteEntity>('/tenant/website');
    return res.data;
  },

  /**
   * Fetch list of available website templates
   */
  getTemplates: async (): Promise<WebsiteTemplateInfo[]> => {
    const res = await api.get<WebsiteTemplateInfo[]>('/tenant/website/templates');
    return res.data;
  },

  /**
   * Save draft content (does not affect live website until published)
   */
  saveDraft: async (content: Partial<WebsiteStructuredContent>): Promise<SalonWebsiteEntity> => {
    const res = await api.put<SalonWebsiteEntity>('/tenant/website/draft', content);
    return res.data;
  },

  /**
   * Publish current draft content to make it live
   */
  publish: async (): Promise<SalonWebsiteEntity> => {
    const res = await api.post<SalonWebsiteEntity>('/tenant/website/publish');
    return res.data;
  },

  /**
   * Unpublish website (sets it to draft mode)
   */
  unpublish: async (): Promise<SalonWebsiteEntity> => {
    const res = await api.post<SalonWebsiteEntity>('/tenant/website/unpublish');
    return res.data;
  },

  /**
   * Revert draft back to current published state
   */
  resetDraft: async (): Promise<SalonWebsiteEntity> => {
    const res = await api.post<SalonWebsiteEntity>('/tenant/website/reset-draft');
    return res.data;
  },

  /**
   * Upload logo, hero banner, or gallery photo
   */
  uploadImage: async (
    file: File,
    category: 'logo' | 'hero' | 'gallery' = 'gallery',
  ): Promise<{ url: string; filename: string; category: string }> => {
    const formData = new FormData();
    formData.append('file', file);

    const res = await api.post<{ url: string; filename: string; category: string }>(
      `/tenant/website/upload?category=${category}`,
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      },
    );
    return res.data;
  },
};
