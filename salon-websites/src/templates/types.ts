import React from 'react';
import { PublicWebsitePayload, SupportedTemplateId } from '@/types';

export interface TemplateProps {
  data: PublicWebsitePayload;
  isPreview?: boolean;
}

export interface TemplateDefinition {
  id: SupportedTemplateId;
  name: string;
  tagline: string;
  description: string;
  category: string;
  previewThumbnail: string;
  defaultThemeColor: string;
  defaultSecondaryColor: string;
  Component: React.ComponentType<TemplateProps>;
}

