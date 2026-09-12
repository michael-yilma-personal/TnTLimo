import type { Metadata } from "next";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import MobileCTA from "@/components/MobileCTA";
import ServiceHero from "@/components/service/ServiceHero";
import ServiceTestimonials from "@/components/service/ServiceTestimonials";
import ServiceFAQ from "@/components/service/ServiceFAQ";
import ServiceCTA from "@/components/service/ServiceCTA";
import RelatedServices from "@/components/service/RelatedServices";
import LAHollywoodContent from "./LAHollywoodContent";
import { SITE_IMAGES } from "@/lib/siteImages";
import { SITE_PRICING } from "@/lib/sitePricing";
import JsonLd from "@/components/seo/JsonLd";
import { serviceJsonLd } from "@/lib/seo/jsonLd";

export const metadata: Metadata = {
  alternates: { canonical: "/los-angeles-hollywood-tour-from-anaheim" },
  title: "Los Angeles & Hollywood Tour from Anaheim | TNT Tours & Transportation",
  description: "Experience the best of Los Angeles on a guided full-day tour from Anaheim with hotel pickup. Hollywood Walk of Fame, Beverly Hills, Griffith Observatory, Santa Monica & more. 5-star rated, small group.",
  keywords: "Los Angeles tour from Anaheim, Hollywood tour from Anaheim, LA sightseeing tour Anaheim, Anaheim to Hollywood tour, Los Angeles day tour, Beverly Hills tour Anaheim, guided LA tour",
};

export default function LAHollywoodTourPage() {
  return (
    <>
      <JsonLd
        data={serviceJsonLd({
          name: "Los Angeles & Hollywood Tour from Anaheim",
          description: "Guided full-day tour of Los Angeles from Anaheim with hotel pickup: Hollywood Walk of Fame, Beverly Hills, Griffith Observatory and Santa Monica.",
          path: "/los-angeles-hollywood-tour-from-anaheim",
          serviceType: "Sightseeing tour",
          offer: { price: SITE_PRICING.fullDayTour.adult, description: "Per adult; children $" + SITE_PRICING.fullDayTour.child + "." },
        })}
      />
      <Header />
      <main>
        <ServiceHero
          eyebrow="Full-Day Guided Tour · Departing from Anaheim"
          headline="Los Angeles & Hollywood Tour from Anaheim"
          subheadline="Experience the best of Los Angeles in one unforgettable day. Hotel pickup from Anaheim included. Expert local guide, comfortable vehicle, and iconic stops — Hollywood, Beverly Hills, Griffith Observatory, and more."
          primaryCTA="Book This Tour"
          secondaryCTA="Ask a Question"
          secondaryHref="/#contact"
          trustBadges={[
            { label: "Hotel Pickup Available" },
            { label: "5-Star Rated" },
            { label: "Small Group Experience" },
            { label: "Family Friendly" },
            { label: "8–10 Hours" },
          ]}
          bgUrl={SITE_IMAGES.hollywoodSignHills}
          bgAlt="Hollywood Sign above the Los Angeles hills"
        />
        <LAHollywoodContent />
        <ServiceTestimonials
          heading="What Guests Say About the LA & Hollywood Tour"
          subheading="Verified reviews from real guests on Google and TripAdvisor."
          reviews={[
            {
              quote: "Our guide was fantastic — funny, knowledgeable, and genuinely passionate about LA. We saw so much more than I expected and left feeling like we truly understood the city.",
              author: "Michael T.",
              location: "New York, NY",
              initials: "MT",
              platform: "Google",
              date: "March 2025",
            },
            {
              quote: "We were a family of 4 staying near Disneyland. The hotel pickup made everything so easy. Our kids loved every stop — especially Griffith Observatory and the Walk of Fame.",
              author: "The Garcias",
              location: "Houston, TX",
              initials: "G",
              platform: "TripAdvisor",
              date: "February 2025",
            },
            {
              quote: "Absolutely worth it. We didn't have to worry about parking, navigation, or figuring out where to go. Just relaxed and enjoyed the whole day. Would book again in a heartbeat.",
              author: "Emma L.",
              location: "London, UK",
              initials: "EL",
              platform: "Google",
              date: "January 2025",
            },
          ]}
        />
        <ServiceFAQ
          heading="Your Questions, Answered"
          items={[
            {
              question: "Where does the tour start?",
              answer: "The tour departs from the Anaheim area. We offer hotel pickup for guests staying at Anaheim-area hotels and resorts, making it especially convenient if you're visiting Disneyland. We'll confirm your exact pickup location and time when you book.",
            },
            {
              question: "Is hotel pickup included?",
              answer: "Yes — hotel pickup from the Anaheim area is included for this tour. We come to you, so you don't have to worry about finding a meeting point or driving anywhere.",
            },
            {
              question: "How much does it cost?",
              answer: `The published rate is $${SITE_PRICING.fullDayTour.adult} per adult and $${SITE_PRICING.fullDayTour.child} per child for the full-day Best of LA tour. Taxes or fees may apply — we'll confirm the total when you book.`,
            },
            {
              question: "How long is the tour?",
              answer: "Pickup from Anaheim and neighboring cities is typically between 7:45 and 8:00 AM, with return to Anaheim between 5:30 and 6:00 PM — a full day on the road. We'll cover a lot of ground while still giving you time at each stop.",
            },
            {
              question: "What stops are included?",
              answer: "The route is built around the classic Best of LA experience: a pass through Downtown LA (Walt Disney Concert Hall, Music Center, arena district), Griffith Park and the Observatory for Hollywood Sign views, the Hollywood Walk of Fame and TCL Chinese Theatre, the Sunset Strip, Beverly Hills and Rodeo Drive, a lunch break at the Original Farmers Market and The Grove, Santa Monica Pier, Venice Beach, and Marina del Rey. Timing at each stop can vary with traffic and your guide's judgment — the goal is the best day possible.",
            },
            {
              question: "Is this tour family-friendly?",
              answer: "Absolutely. We host families with children of all ages regularly. If you have specific needs — young kids, elderly guests, or special requirements — just let us know when booking and we'll accommodate.",
            },
            {
              question: "How many people are on the tour?",
              answer: "We intentionally keep group sizes small so every guest gets personal attention and a great experience. You'll never be on a crowded bus with dozens of strangers. For a completely private experience, check out our Private LA Tour.",
            },
            {
              question: "What should we bring?",
              answer: "Comfortable walking shoes, sunscreen, a camera, and a great attitude. We recommend dressing in layers as LA temperatures can vary throughout the day. Water and snacks are also a good idea for the journey.",
            },
          ]}
        />
        <ServiceCTA
          headline="Ready to See Los Angeles?"
          subtext="Check what's available for your dates and we'll take care of everything — pickup, guidance, and an unforgettable day in LA."
        />
        <RelatedServices
          services={[
            {
              title: "Private LA & Hollywood Tour",
              description: "Your group, your vehicle, your day. Fully customizable with stops of your choice.",
              href: "/private-los-angeles-tour",
              bg: SITE_IMAGES.griffithSunsetAerial,
              badge: "100% Private",
            },
            {
              title: "Universal Studios Transportation",
              description: "Skip the parking and stress. Comfortable roundtrip pickup from your Anaheim hotel.",
              href: "/universal-studios-transportation-anaheim",
              bg: SITE_IMAGES.universalGlobe,
              badge: "Roundtrip",
            },
          ]}
        />
      </main>
      <Footer />
      <MobileCTA />
    </>
  );
}
