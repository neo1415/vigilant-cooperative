import { Navbar } from '@/components/navbar';
import { HeroSection } from '@/components/hero-section';
import { TrustMarquee } from '@/components/trust-marquee';
import { FeaturesSection } from '@/components/features-section';
import { HowItWorksSection } from '@/components/how-it-works-section';
import { StatsSection } from '@/components/stats-section';
import { SecuritySection } from '@/components/security-section';
import { FAQSection } from '@/components/faq-section';
import { CTAFooter } from '@/components/cta-footer';

export default function Home() {
  return (
    <div className="min-h-screen">
      <Navbar />
      <HeroSection />
      <TrustMarquee />
      <FeaturesSection />
      <HowItWorksSection />
      <StatsSection />
      <SecuritySection />
      <FAQSection />
      <CTAFooter />
    </div>
  );
}
