import type { Metadata } from "next";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import MobileCTA from "@/components/MobileCTA";
import ServiceHero from "@/components/service/ServiceHero";
import ServiceTestimonials from "@/components/service/ServiceTestimonials";
import ServiceFAQ from "@/components/service/ServiceFAQ";
import ServiceCTA from "@/components/service/ServiceCTA";
import RelatedServices from "@/components/service/RelatedServices";
import UniversalContent from "./UniversalContent";
import { SITE_IMAGES } from "@/lib/siteImages";
import { GROUP_OVER_12_CALL_TEXT, SITE_PRICING } from "@/lib/sitePricing";
import JsonLd from "@/components/seo/JsonLd";
import { serviceJsonLd } from "@/lib/seo/jsonLd";

export const metadata: Metadata = {
  alternates: { canonical: "/universal-studios-transportation-anaheim" },
  title: "Universal Studios Transportation from Anaheim | Roundtrip Shuttle | TNT Tours",
  description: "Skip the parking and stress. Comfortable roundtrip transportation from Anaheim to Universal Studios Hollywood. Hotel pickup available, family-friendly, reliable and on-time service.",
  keywords: "Universal Studios transportation from Anaheim, Anaheim to Universal Studios, roundtrip transportation Universal Studios Hollywood, Universal Studios shuttle Anaheim, private transportation Universal Studios",
};

export default function UniversalTransportPage() {
  return (
    <>
      <JsonLd
        data={serviceJsonLd({
          name: "Universal Studios Transportation from Anaheim",
          description: "Roundtrip private transportation between Anaheim hotels and Universal Studios Hollywood, with hotel pickup and a coordinated return.",
          path: "/universal-studios-transportation-anaheim",
          serviceType: "Airport and attraction transfer",
          offer: { price: SITE_PRICING.universalRoundTripTransport[0].price, description: "Roundtrip, total per group for 1\u20134 guests." },
        })}
      />
      <Header />
      <main>
        <ServiceHero
          eyebrow="Roundtrip Transportation · Departing from Anaheim"
          headline="Universal Studios Transportation from Anaheim"
          subheadline="Skip the $45 parking fee and freeway stress. Enjoy comfortable roundtrip transportation from your Anaheim hotel directly to Universal Studios Hollywood — on time, every time."
          primaryCTA="Book Now"
          secondaryCTA="Ask a Question"
          secondaryHref="/#contact"
          trustBadges={[
            { label: "Roundtrip Service" },
            { label: "Hotel Pickup" },
            { label: "Comfortable Vehicle" },
            { label: "Family Friendly" },
            { label: "On-Time, Every Time" },
          ]}
          bgUrl={SITE_IMAGES.universalGlobe}
          bgAlt="Universal Studios Hollywood globe at night"
          overlay="linear-gradient(160deg, rgba(10,8,20,0.88) 0%, rgba(20,12,36,0.65) 45%, rgba(10,8,20,0.90) 100%)"
        />
        <UniversalContent />
        <ServiceTestimonials
          heading="What Guests Say About the Transportation"
          subheading="Real reviews from families and visitors who used our Universal Studios transportation."
          reviews={[
            {
              quote: "Such a stress-free way to get to Universal Studios from Anaheim. Pickup was right on time, the driver was friendly and professional. We didn't think about parking for a second.",
              author: "Priya S.",
              location: "Toronto, Canada",
              initials: "PS",
              platform: "Google",
              date: "January 2025",
            },
            {
              quote: "Our kids loved it. We didn't have to deal with traffic or figuring out where to park. The vehicle was so comfortable — we started the day relaxed instead of stressed.",
              author: "The Patel Family",
              location: "Dallas, TX",
              initials: "P",
              platform: "TripAdvisor",
              date: "December 2024",
            },
            {
              quote: "Totally worth it. Pickup was smooth, the van was clean and spacious for our group, and the return pickup at the end of the day was perfectly timed. Will book again.",
              author: "James R.",
              location: "Boston, MA",
              initials: "JR",
              platform: "Google",
              date: "February 2025",
            },
          ]}
        />
        <ServiceFAQ
          heading="Questions About the Transportation"
          items={[
            {
              question: "Is this service roundtrip?",
              answer: "Yes — this is a full roundtrip service. We pick you up in Anaheim, drop you off at Universal Studios Hollywood, and bring you back at the end of the day. No need to arrange separate return transportation.",
            },
            {
              question: "Where is the pickup location?",
              answer: "We offer pickup from Anaheim-area hotels and resorts. When you book, we'll confirm your exact pickup address and provide full details on meeting location and timing.",
            },
            {
              question: "What does transportation cost?",
              answer: `Roundtrip transportation is priced per group (not per person): ${SITE_PRICING.universalRoundTripTransport.map((r) => `${r.guests} guests $${r.price}`).join(", ")}. ${GROUP_OVER_12_CALL_TEXT} Confirm current pricing when you book.`,
            },
            {
              question: "What time is pickup and return?",
              answer: "Hotel pickup is typically between 8:00 and 8:15 AM from Anaheim and neighboring cities. Return from Universal Studios is usually between 6:00 and 7:00 PM. We'll confirm exact times when you book.",
            },
            {
              question: "Is the vehicle just for our group?",
              answer: "Depending on your booking, the vehicle may be shared with other guests or arranged as a private service. Contact us for details on private booking options if you prefer the vehicle exclusively for your group.",
            },
            {
              question: "Can families with young children use this?",
              answer: "Absolutely. We regularly transport families with children of all ages. If you have strollers, car seats, or other needs, let us know when booking so we can accommodate everything.",
            },
            {
              question: "Can we bring backpacks and bags?",
              answer: "Yes — there's plenty of space for daypacks, bags, and typical theme park gear. If you have large items or need extra space, just mention it when booking.",
            },
            {
              question: "How does the return pickup work?",
              answer: "We'll coordinate a return pickup time before your visit and stay reachable throughout the day. When you're ready, we come to you. No stress, no rideshare uncertainty at the end of a long day.",
            },
          ]}
        />
        <ServiceCTA
          headline="Ready for a Stress-Free Day at Universal?"
          subtext="Check availability, confirm your pickup, and leave the driving to us. You focus on the fun."
          trustPoints={["Roundtrip from your Anaheim hotel", "On time, every time", "5-star rated service"]}
        />
        <RelatedServices
          services={[
            {
              title: "Full-Day LA & Hollywood Tour",
              description: "While you're in Anaheim — see all of Los Angeles in one guided day with hotel pickup.",
              href: "/los-angeles-hollywood-tour-from-anaheim",
              bg: SITE_IMAGES.hollywoodSignHills,
              badge: "Most Popular",
            },
            {
              title: "Private LA & Hollywood Tour",
              description: "Your group, your vehicle, your day. A fully private and customizable LA experience.",
              href: "/private-los-angeles-tour",
              bg: SITE_IMAGES.griffithSunsetAerial,
              badge: "100% Private",
            },
          ]}
        />
      </main>
      <Footer />
      <MobileCTA />
    </>
  );
}
