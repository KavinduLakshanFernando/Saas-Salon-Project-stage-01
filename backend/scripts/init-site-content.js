const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const crypto = require('crypto');

async function main() {
  const website = await prisma.salonWebsite.findFirst({
    where: { subdomain: 'salon-heart' },
    include: { tenant: true },
  });
  if (!website) return;

  const defaultContent = {
    templateId: 'modern-beauty',
    branding: {
      title: website.title,
      tagline: website.tagline || 'Experience elegance & personalized beauty',
      description: website.description || 'Premium salon treatments and contemporary styling.',
      themeColor: website.themeColor || '#7C3AED',
      secondaryColor: '#EC4899',
      logoUrl: website.logoUrl,
      bannerUrl: website.bannerUrl,
      heroImages: [],
    },
    hero: {
      badgeText: 'Premium Hair, Beauty & Grooming',
      headline: website.title,
      subheadline: website.tagline || 'Discover exceptional hair styling, vibrant color, and personalized beauty care.',
      ctaText: 'View Services & Pricing',
      ctaLink: '#services',
      secondaryCtaText: 'Call Us Now',
      secondaryCtaLink: '#contact',
    },
    about: {
      heading: 'Passionate About Bringing Out Your Best Look',
      subheading: 'Crafted with passion, skill, and exceptional attention to detail.',
      story: `At ${website.title}, our team of certified professionals is committed to delivering an extraordinary salon experience.`,
      quote: 'We dont just style hair — we build confidence and lasting relationships.',
      highlights: [
        { title: 'Certified Stylists', description: 'Master stylists continuously trained in contemporary trends.' },
        { title: '100% Hygienic Care', description: 'Hospital-grade sterilization for all tools and stations.' },
        { title: 'Premium Products', description: 'Top-tier cruelty-free, professional-grade styling lines.' },
      ],
    },
    servicesConfig: {
      featuredServiceCodes: [],
      showPricing: true,
      showDuration: true,
    },
    gallery: [],
    contact: {
      phone: website.contactPhone || '0716507009',
      email: website.contactEmail || 'kavindu009lakshan@gmail.com',
      address: website.address || '123 Galle Road, Colombo 03, Sri Lanka',
      workingHours: 'Monday – Sunday: 9:00 AM – 7:30 PM',
      googleMapsEmbedUrl: '',
    },
    socialLinks: {
      facebook: '',
      instagram: '',
      whatsapp: 'https://wa.me/94716507009',
      tiktok: '',
      youtube: '',
    },
    seo: {
      title: `${website.title} | Official Salon Website`,
      description: 'Explore our services, book appointments, and find directions.',
      keywords: 'salon, hair, beauty, colombo',
      ogImageUrl: '',
    },
  };

  const previewToken = crypto.randomBytes(24).toString('hex');

  await prisma.salonWebsite.update({
    where: { id: website.id },
    data: {
      previewToken,
      draftContent: defaultContent,
      publishedContent: defaultContent,
      publishedAt: new Date(),
    },
  });

  console.log('Successfully initialized draft and published content for salon-heart!');
}

main().catch(console.error).finally(() => prisma.$disconnect());

