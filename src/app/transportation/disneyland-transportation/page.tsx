import type { Metadata } from "next";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import TransportationServiceDetail from "@/components/transportation/TransportationServiceDetail";
import { SITE_IMAGES } from "@/lib/siteImages";
import JsonLd from "@/components/seo/JsonLd";
import { serviceJsonLd } from "@/lib/seo/jsonLd";

export const metadata: Metadata = {
  alternates: { canonical: "/transportation/disneyland-transportation" },
  title: "Disneyland Transportation from Anaheim Hotels | TNT Tours",
  description:
    "Comfortable private transportation between Anaheim hotels, Disneyland, Universal Studios, and Southern California airports. Family-friendly vehicles, child seats on request, and door-to-door service.",
  keywords:
    "Disneyland transportation, Anaheim hotel transportation, Disneyland hotel transfer, family transportation Anaheim, group transportation Disneyland, Anaheim to Universal Studios transportation",
};

export default function DisneylandTransportationPage() {
  return (
    <>
      <JsonLd
        data={serviceJsonLd({
          name: "Disneyland Transportation from Anaheim Hotels",
          description: "Private door-to-door transportation between Anaheim hotels and the Disneyland Resort, with child seats on request.",
          path: "/transportation/disneyland-transportation",
          serviceType: "Attraction transfer",
        })}
      />
      <Header />
      <TransportationServiceDetail
        title="Disneyland & Hotel Transportation"
        description="Comfortable private transportation for families and groups traveling between Anaheim hotels, Disneyland, Universal Studios, airports, and popular Southern California destinations."
        image={SITE_IMAGES.universalGlobe}
        imageAlt="Family transportation at the Disneyland Resort"
        highlights={[
          "Door-to-door service between Disneyland-area hotels and the parks.",
          "Family-friendly vehicles with luggage room and complimentary child seats on request.",
          "Hotel-to-airport transfers for SNA, LAX, Long Beach, Burbank, Ontario, and San Diego.",
          "Great for convention groups and multi-stop family days out.",
        ]}
        ctaLabel="Book Disneyland transportation"
        ctaHref="/transportation/book?service=disneyland-transportation"
        showCarSeatsCallout
      />
      <Footer />
    </>
  );
}
