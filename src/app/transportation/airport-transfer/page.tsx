import type { Metadata } from "next";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import TransportationServiceDetail from "@/components/transportation/TransportationServiceDetail";
import { SITE_IMAGES } from "@/lib/siteImages";
import JsonLd from "@/components/seo/JsonLd";
import { serviceJsonLd } from "@/lib/seo/jsonLd";

export const metadata: Metadata = {
  alternates: { canonical: "/transportation/airport-transfer" },
  title: "Anaheim Airport Transportation | LAX, SNA, LGB, BUR, ONT, SAN | TNT Tours",
  description:
    "Reliable private airport transportation to and from Anaheim, Disneyland-area hotels, and major Southern California airports including LAX, SNA, Long Beach, Burbank, Ontario, and San Diego.",
  keywords:
    "Anaheim airport transportation, LAX to Anaheim transportation, SNA to Disneyland transportation, Anaheim hotel airport transfer, private airport transfer Anaheim",
};

export default function AirportTransferPage() {
  return (
    <>
      <JsonLd
        data={serviceJsonLd({
          name: "Anaheim Airport Transportation",
          description: "Private airport transfers between Anaheim and Disneyland-area hotels and LAX, SNA, Long Beach, Burbank, Ontario and San Diego airports.",
          path: "/transportation/airport-transfer",
          serviceType: "Airport shuttle service",
        })}
      />
      <Header />
      <TransportationServiceDetail
        title="Airport Pickup & Drop-off"
        description="Reliable private airport transportation to and from Anaheim, Disneyland-area hotels, and major Southern California airports including LAX, SNA, Long Beach, Burbank, Ontario, and San Diego."
        image={SITE_IMAGES.waltDisneyConcertHall}
        imageAlt="Airport transportation at a California hotel"
        highlights={[
          "Door-to-door airport pickup and drop-off.",
          "Meet & greet service available for smooth arrivals.",
          "Round-trip pricing available for return flights.",
          "Great for families, groups, and convention travelers.",
        ]}
        ctaLabel="Book airport pickup & drop-off"
        ctaHref="/transportation/book?service=airport-transfer"
        showCarSeatsCallout
      />
      <Footer />
    </>
  );
}
