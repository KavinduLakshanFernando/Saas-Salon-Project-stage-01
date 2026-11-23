import { Footer } from '@/components/layout/Footer';
import { Header } from '@/components/layout/Header';
import { WhatsAppWidget } from '@/components/ui/WhatsAppWidget';
import { ScrollToTop } from '@/components/ui/ScrollToTop';
import { ScrollProgressBar } from '@/components/ui/ScrollReveal';

export function MarketingShell({ children }: { children: React.ReactNode }) {
  return (
    <>
      <ScrollProgressBar />
      <Header />
      <main className="pt-18 sm:pt-20">{children}</main>
      <Footer />
      <WhatsAppWidget />
      <ScrollToTop />
    </>
  );
}

