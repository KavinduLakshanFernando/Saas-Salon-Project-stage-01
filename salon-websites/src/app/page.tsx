import React from 'react';
import { Metadata } from 'next';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { Eye, AlertTriangle } from 'lucide-react';
import { fetchPublicSalonData } from '@/lib/api';
import { templateRegistry } from '@/templates/registry';

interface PageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

async function resolveTenantParams(searchParamsPromise: Promise<{ [key: string]: string | string[] | undefined }>) {
  const searchParams = await searchParamsPromise;
  const headersList = await headers();

  const querySubdomain =
    typeof searchParams.subdomain === 'string'
      ? searchParams.subdomain
      : typeof searchParams.salon === 'string'
      ? searchParams.salon
      : null;

  const headerSubdomain = headersList.get('x-salon-subdomain');
  const headerHostname = headersList.get('x-salon-hostname');

  const subdomain = querySubdomain || headerSubdomain || null;
  const hostname = headerHostname || null;

  const preview =
    searchParams.preview === 'true' || headersList.get('x-salon-preview') === 'true';

  const token =
    typeof searchParams.token === 'string'
      ? searchParams.token
      : typeof searchParams.previewToken === 'string'
      ? searchParams.previewToken
      : headersList.get('x-salon-preview-token') || null;

  return { subdomain, hostname, preview, token };
}

export async function generateMetadata({ searchParams }: PageProps): Promise<Metadata> {
  const { subdomain, hostname, preview, token } = await resolveTenantParams(searchParams);
  const data = await fetchPublicSalonData({ subdomain, hostname, preview, token });

  if (!data) {
    return {
      title: 'Salon Not Found | Dart Smart Salon',
      description: 'The requested salon website could not be found or is currently inactive.',
    };
  }

  const { website, salon, content } = data;
  const seo = content?.seo || {};
  const branding = content?.branding || {};

  const title =
    seo.title ||
    website.seoTitle ||
    `${branding.title || website.title || salon.name} | Official Salon Website`;

  const description =
    seo.description ||
    website.seoDescription ||
    branding.tagline ||
    website.tagline ||
    `Experience exceptional hair styling and beauty care at ${branding.title || website.title || salon.name}.`;

  const ogImage = seo.ogImageUrl || website.ogImageUrl || branding.bannerUrl || website.bannerUrl;

  return {
    title,
    description,
    keywords: seo.keywords || website.seoKeywords || 'salon, hair, beauty, styling',
    openGraph: {
      title,
      description,
      images: ogImage ? [{ url: ogImage }] : undefined,
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: ogImage ? [ogImage] : undefined,
    },
    robots: {
      index: !data.isPreview && website.isPublished,
      follow: !data.isPreview && website.isPublished,
    },
  };
}

export default async function SalonHomePage({ searchParams }: PageProps) {
  const { subdomain, hostname, preview, token } = await resolveTenantParams(searchParams);

  if (!subdomain && !hostname) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center">
        <div className="max-w-md w-full bg-white p-8 rounded-3xl border border-slate-200 shadow-xl space-y-4">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-purple-100 text-purple-700 flex items-center justify-center font-bold text-xl">
            DS
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Dart Smart Salon Websites</h1>
          <p className="text-sm text-slate-600">
            Multi-tenant public salon portal. Each salon has its dedicated website powered by this engine.
          </p>
          <div className="pt-2 text-left bg-slate-50 p-4 rounded-xl text-xs space-y-2 border border-slate-100">
            <p className="font-semibold text-slate-700">Preview a Salon Website Locally:</p>
            <a
              href="/?subdomain=salon-heart"
              className="block font-mono text-purple-600 hover:underline break-all"
            >
              http://localhost:3002/?subdomain=salon-heart
            </a>
          </div>
        </div>
      </div>
    );
  }

  const data = await fetchPublicSalonData({ subdomain, hostname, preview, token });

  if (!data) {
    notFound();
  }

  // Look up selected template from developer registry
  const templateId = data.content?.templateId || data.templateId || data.website.templateId;
  const template = templateRegistry.get(templateId);
  const TemplateComponent = template.Component;

  return (
    <div className="min-h-screen flex flex-col">
      {/* Draft Preview Bar if in preview mode */}
      {data.isPreview && (
        <div className="sticky top-0 z-50 bg-amber-500 text-amber-950 px-4 py-2 text-center text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 shadow-md">
          <Eye className="w-4 h-4 shrink-0" />
          <span>
            <strong>Draft Preview Mode:</strong> Viewing unpublished changes for template &ldquo;{template.name}&rdquo;. Normal visitors see the published site.
          </span>
        </div>
      )}

      {/* Dynamic Template Component */}
      <TemplateComponent data={data} isPreview={data.isPreview} />
    </div>
  );
}
