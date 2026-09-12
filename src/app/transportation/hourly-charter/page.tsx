import type { Metadata } from "next";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import TransportationServiceDetail from "@/components/transportation/TransportationServiceDetail";
import { SITE_IMAGES } from "@/lib/siteImages";
import JsonLd from "@/components/seo/JsonLd";
import { serviceJsonLd } from "@/lib/seo/jsonLd";

export const metadata: Metadata = {
  alternates: { canonical: "/transportation/hourly-charter" },
  title: "Hourly Charter Transportation in Anaheim | TNT Tours",
  description:
    "Reserve a private vehicle and driver by the hour for events, shopping, sightseeing, business travel, or multiple stops across Anaheim and Southern California.",
  keywords:
    "hourly charter Anaheim, group transportation Anaheim, private driver Anaheim, charter service Southern California",
};

export default function HourlyCharterPage() {
  return (
    <>
      <JsonLd
        data={serviceJsonLd({
          name: "Hourly Charter Transportation in Anaheim",
          description: "A private vehicle and driver reserved by the hour for events, shopping, sightseeing, business travel or multi-stop days.",
          path: "/transportation/hourly-charter",
          serviceType: "Charter service",
        })}
      />
      <Header />
      <TransportationServiceDetail
        title="Hourly Charter"
        description="Reserve a private vehicle and driver by the hour for events, shopping, sightseeing, business travel, or multiple stops across Anaheim and Southern California."
        image={SITE_IMAGES.santaMonicaPalms}
        imageAlt="Hourly charter transportation on Southern California streets"
        highlights={[
          "3-hour minimum for sedan & SUV, 4-hour minimum for van & sprinter.",
          "Flexible itinerary planning with optional stops.",
          "Ideal for conventions, weddings, and family outings.",
          "Child seats available upon request at no extra charge.",
        ]}
        ctaLabel="Book hourly charter"
        ctaHref="/transportation/book?service=hourly-charter"
        note={
          <p className="text-sm text-muted leading-relaxed">
            Hourly charter pricing is based on passenger group size and time. We will confirm the final quote during booking.
          </p>
        }
      />
      <Footer />
    </>
  );
}
