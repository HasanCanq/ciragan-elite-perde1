export const revalidate = 3600;

import HeroSection      from "@/components/sections/HeroSection";
import FeaturedProducts from "@/components/sections/FeaturedProducts";
import CategoryGrid     from "@/components/sections/CategoryGrid";
import NewsletterCTA    from "@/components/sections/NewsletterCTA";
import { JsonLd }       from "@/components/seo/JsonLd";
import { buildLocalBusinessSchema } from "@/lib/seo/schemas";
import { getGooglePlaceSummary }    from "@/lib/data/google-reviews";

export default async function HomePage() {
  const placeSummary = await getGooglePlaceSummary();

  const localBusinessSchema = buildLocalBusinessSchema({
    aggregateRating: placeSummary?.total_rating && placeSummary.total_reviews
      ? {
          ratingValue: Number(placeSummary.total_rating),
          reviewCount: placeSummary.total_reviews,
        }
      : null,
  });

  return (
    <>
      <JsonLd data={localBusinessSchema} />
      <HeroSection />
      <FeaturedProducts />
      <CategoryGrid />
      <NewsletterCTA />
    </>
  );
}
