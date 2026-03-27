export const revalidate = 3600;

import HeroSection      from "@/components/sections/HeroSection";
import FeaturedProducts from "@/components/sections/FeaturedProducts";
import CategoryGrid     from "@/components/sections/CategoryGrid";
import NewsletterCTA    from "@/components/sections/NewsletterCTA";

export default function HomePage() {
  return (
    <>
      <HeroSection />
      <FeaturedProducts />
      <CategoryGrid />
      <NewsletterCTA />
    </>
  );
}
