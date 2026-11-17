import { Benefits } from "@/components/examples/marketing/benefits";
import { FAQ } from "@/components/examples/marketing/faq";
import { Footer } from "@/components/examples/marketing/footer";
import { Hero } from "@/components/examples/marketing/hero";
import { Insights } from "@/components/examples/marketing/insights";
import { LogoStrip } from "@/components/examples/marketing/logo-strip";
import { Metrics } from "@/components/examples/marketing/metrics";
import { Nav } from "@/components/examples/marketing/nav";
import { Newsletter } from "@/components/examples/marketing/newsletter";
import { Pricing } from "@/components/examples/marketing/pricing";
import { Testimonials } from "@/components/examples/marketing/testimonials";

export default function MarketingDemo() {
  return (
    <div className="flex flex-col">
      <Nav />
      <Hero />
      <LogoStrip />
      <Benefits />
      <Testimonials />
      <Metrics />
      <Pricing />
      <Insights />
      <FAQ />
      <Newsletter />
      <Footer />
    </div>
  );
}
