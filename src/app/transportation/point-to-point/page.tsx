import type { Metadata } from "next";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import TransportationServiceDetail from "@/components/transportation/TransportationServiceDetail";
import { SITE_IMAGES } from "@/lib/siteImages";
import JsonLd from "@/components/seo/JsonLd";
import { serviceJsonLd } from "@/lib/seo/jsonLd";

export const metadata: Metadata = {
  alternates: { canonical: "/transportation/point-to-point" },
  title: "Point-to-Point Transportation in Anaheim & LA | TNT Tours",
  description:
    "Private transportation between hotels, attractions, airports, restaurants, event venues, and other destinations across Anaheim and Los Angeles.",
  keywords:
    "point to point transportation Anaheim, Anaheim to LA transportation, hotel transfer Anaheim, group transportation Anaheim",
};

export default function PointToPointPage() {
  return (
    <>
      <JsonLd
        data={serviceJsonLd({
          name: "Point-to-Point Transportation in Anaheim & Los Angeles",
          description: "Private transportation between hotels, attractions, airports, restaurants and event venues across Anaheim and Los Angeles.",
          path: "/transportation/point-to-point",
          serviceType: "Transportation service",
        })}
      />
      <Header />
      <TransportationServiceDetail
        title="Point-to-Point Transportation"
        description="Private transportation between hotels, attractions, airports, restaurants, event venues, and other destinations across Anaheim and Los Angeles."
        image={SITE_IMAGES.griffithObservatoryDay}
        imageAlt="Point-to-point ride in Los Angeles"
        highlights={[
          "Fixed route pricing examples for SNA, Universal Studios, and Downtown LA. For LAX transfers, please use Airport Pickup & Drop-off.",
          "Optional extra stop keeps your trip flexible.",
          "All rides include private black vehicles and free child seats on request.",
          "Passenger groups from 1 to 14 supported with quick quotes.",
        ]}
        ctaLabel="Book point-to-point"
        ctaHref="/transportation/book?service=point-to-point"
        showCarSeatsCallout
      />
      <Footer />
    </>
  );
}
