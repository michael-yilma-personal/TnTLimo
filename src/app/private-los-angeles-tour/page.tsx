import type { Metadata } from "next";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import MobileCTA from "@/components/MobileCTA";
import ServiceHero from "@/components/service/ServiceHero";
import ServiceTestimonials from "@/components/service/ServiceTestimonials";
import ServiceFAQ from "@/components/service/ServiceFAQ";
import ServiceCTA from "@/components/service/ServiceCTA";
import RelatedServices from "@/components/service/RelatedServices";
import PrivateTourContent from "./PrivateTourContent";
import { SITE_IMAGES } from "@/lib/siteImages";
import { SITE_CONTACT } from "@/lib/siteContact";
import { SITE_PRICING } from "@/lib/sitePricing";
import JsonLd from "@/components/seo/JsonLd";
import { serviceJsonLd } from "@/lib/seo/jsonLd";

export const metadata: Metadata = {
  alternates: { canonical: "/private-los-angeles-tour" },
  title: "Private Los Angeles Tour | Custom Private Hollywood Tour | TNT Tours & Transportation",
  description: "Book a fully private, customizable Los Angeles tour with hotel pickup from Anaheim. Your group, your vehicle, your itinerary. Hollywood, Beverly Hills, Griffith Observatory & more — on your schedule.",
  keywords: "private Los Angeles tour, private Hollywood tour, private LA tour from Anaheim, custom Los Angeles tour, private sightseeing tour LA, private Beverly Hills tour, customizable LA tour, private tour guide Los Angeles",
};

export default function PrivateLATourPage() {
  return (
    <>
      <JsonLd
        data={serviceJsonLd({
          name: "Private Los Angeles Tour",
          description: "Fully private, customisable Los Angeles tour with hotel pickup from Anaheim. Your group, your vehicle, your itinerary.",
          path: "/private-los-angeles-tour",
          serviceType: "Private sightseeing tour",
          offer: { price: SITE_PRICING.privateTour6to7Hr[0].price, description: "6\u20137 hour private tour, total per group for 1\u20134 guests." },
        })}
      />
      <Header />
      <main>
        <ServiceHero
          eyebrow="100% Private · Fully Customizable · Departing from Anaheim"
          headline="Private Los Angeles Tour"
          subheadline={`See Los Angeles your way — your vehicle, your itinerary, your pace. Custom 6–7 hour private days from $${SITE_PRICING.privateTour6to7Hr[0].price} for 1–4 guests (per group), or plan a longer full-day route. Movie-star home drives, Rodeo shopping, and airport dropoffs available — just ask.`}
          primaryCTA="Book This Tour"
          secondaryCTA="Ask a Question"
          secondaryHref="/#contact"
          trustBadges={[
            { label: "100% Private — Just Your Group" },
            { label: "Hotel Pickup Included" },
            { label: "Fully Customizable" },
            { label: "5-Star Rated" },
            { label: "Family & Group Friendly" },
          ]}
          bgUrl={SITE_IMAGES.griffithSunsetAerial}
          bgAlt="Griffith Observatory and the Los Angeles skyline at sunset"
          overlay="linear-gradient(160deg, rgba(8,6,16,0.92) 0%, rgba(18,10,30,0.65) 45%, rgba(8,6,16,0.92) 100%)"
        />
        <PrivateTourContent />
        <ServiceTestimonials
          heading="What Guests Say About the Private Tour"
          subheading="Real reviews from families, couples, and groups who chose the private experience."
          reviews={[
            {
              quote: "We had the whole van to ourselves, and our guide let us linger at every stop we wanted. Beverly Hills, the Observatory, the Walk of Fame — all at our pace. This is the only way to do LA.",
              author: "Sarah & Mark D.",
              location: "Chicago, IL",
              initials: "SD",
              platform: "Google",
              date: "March 2025",
            },
            {
              quote: "Booked this for my parents' anniversary and they absolutely loved it. The guide was thoughtful, the vehicle was luxurious, and having complete privacy made the day feel truly special.",
              author: "Kenji M.",
              location: "Seattle, WA",
              initials: "KM",
              platform: "TripAdvisor",
              date: "January 2025",
            },
            {
              quote: "We're a group of 8 and needed something flexible. TNT delivered — they accommodated every request, kept us on schedule, and made the whole day feel effortless. Worth every penny.",
              author: "The Okonkwo Group",
              location: "Atlanta, GA",
              initials: "OK",
              platform: "Google",
              date: "February 2025",
            },
          ]}
        />
        <ServiceFAQ
          heading="Questions About the Private Tour"
          items={[
            {
              question: "Is the vehicle exclusively for our group?",
              answer: "Yes — 100%. The private tour means the vehicle is reserved solely for your group. There are no other guests, no strangers, and no compromises. Just your group and your guide for the entire day.",
            },
            {
              question: "Can we customize the itinerary?",
              answer: "Absolutely. That's the whole point of a private tour. You can tell us which stops matter most to you, how long you want to spend at each, and if there's anything specific — a neighborhood, a restaurant, a viewpoint — you'd like included. We'll build the day around you.",
            },
            {
              question: "Where does the tour depart from?",
              answer: "We offer hotel pickup from Anaheim-area hotels and resorts. If you're staying near Disneyland or elsewhere in Anaheim, we come to you. We'll confirm your exact pickup address and timing when you book.",
            },
            {
              question: "How much does a private tour cost?",
              answer: `Our published 6–7 hour private tour is priced per group (not per person): $590 for 1–4 guests, $690 for 5–8, $790 for 9–10, and $890 for 11–12. Groups over 12: please call for pricing. Longer full-day private itineraries are quoted on request. Call ${SITE_CONTACT.phoneDisplay} or email ${SITE_CONTACT.email} to customize.`,
            },
            {
              question: "How long is the private tour?",
              answer: "Many guests book a 6–7 hour private day; we also offer longer full-day experiences similar to our Best of LA route. Tell us your priorities — time at each stop, airport dropoff after the tour, or a shorter highlights tour — and we'll build a schedule that fits.",
            },
            {
              question: "Is this good for special occasions?",
              answer: "It's perfect for them. We regularly host anniversary trips, birthday celebrations, family reunions, and milestone experiences. If you have something special in mind — a particular stop, a specific photo spot, a surprise element — let us know and we'll make it happen.",
            },
            {
              question: "How many people can join the private tour?",
              answer: "Our premium vehicles comfortably fit groups of varying sizes. When you contact us, let us know your group size and we'll confirm vehicle assignment — we may use our own vans or trusted partner vehicles in the same luxury class. We accommodate families, couples, and larger groups alike.",
            },
            {
              question: "What's the difference between the private tour and the group LA tour?",
              answer: "The group LA tour follows a set itinerary with a small number of other guests. The private tour is exclusively for your group, with a fully flexible itinerary, no shared space, and the ability to go at your own pace. If privacy and customization matter to you, the private tour is the right choice.",
            },
          ]}
        />
        <ServiceCTA
          headline="Ready to Experience LA Your Way?"
          subtext="Your group, your vehicle, your itinerary. Check availability and let's plan your perfect private Los Angeles day."
          trustPoints={["100% private — just your group", "Hotel pickup from Anaheim included", "5-star rated, expert local guide"]}
        />
        <RelatedServices
          services={[
            {
              title: "Full-Day LA & Hollywood Tour",
              description: "Our guided small-group tour — see all the highlights from Anaheim with expert commentary.",
              href: "/los-angeles-hollywood-tour-from-anaheim",
              bg: SITE_IMAGES.hollywoodSignHills,
              badge: "Most Popular",
            },
            {
              title: "Universal Studios Transportation",
              description: "Skip the parking and stress. Roundtrip transportation from your Anaheim hotel to Universal Studios.",
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
