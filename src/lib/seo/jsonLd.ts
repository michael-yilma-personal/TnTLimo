/**
 * Structured data (JSON-LD) for search engines.
 *
 * The site had none, so Google had to infer what TNT Tours is, where it
 * operates, and what each service costs from prose alone. These builders
 * state it explicitly, which is what makes a page eligible for rich results
 * (FAQ accordions, price and service details in the SERP).
 *
 * Two deliberate omissions:
 *  - No `aggregateRating`. Self-serving review markup on a business's own site
 *    is against Google's structured-data guidelines and risks a manual action.
 *    The on-page testimonials stay as plain content.
 *  - No street address. We only publish "Based in Anaheim, CA", so the address
 *    is emitted at locality level rather than inventing a street that would
 *    contradict the Business Profile.
 */

import { SITE_CONTACT } from "@/lib/siteContact";
import { SITE_URL } from "@/lib/siteEnv";
import { publicUrl } from "@/lib/publicPath";

/** Stable @id for the business node so other nodes can reference it. */
const BUSINESS_ID = `${SITE_URL}/#business`;

const TELEPHONE = SITE_CONTACT.phoneHref.replace(/^tel:/, "");

export function absoluteUrl(path: string): string {
  if (/^https?:\/\//.test(path)) return path;
  return `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

/**
 * The business itself. Rendered once, in the root layout, so every page
 * carries it. `TravelAgency` is the closest schema.org type that is also a
 * `LocalBusiness`, which is what Google reads for local results.
 */
export function localBusinessJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "TravelAgency",
    "@id": BUSINESS_ID,
    name: "TNT Tours & Transportation",
    url: SITE_URL,
    logo: absoluteUrl(publicUrl("/tnt-tours-logo.png")),
    image: absoluteUrl(publicUrl("/tnt-tours-logo.png")),
    telephone: TELEPHONE,
    email: SITE_CONTACT.email,
    priceRange: "$$",
    description:
      "Anaheim-based tours and private transportation: airport transfers, Disneyland and Universal Studios transportation, and guided Los Angeles and Hollywood tours.",
    address: {
      "@type": "PostalAddress",
      addressLocality: "Anaheim",
      addressRegion: "CA",
      addressCountry: "US",
    },
    areaServed: [
      { "@type": "City", name: "Anaheim" },
      { "@type": "City", name: "Los Angeles" },
      { "@type": "AdministrativeArea", name: "Orange County" },
      { "@type": "AdministrativeArea", name: "Southern California" },
    ],
    contactPoint: {
      "@type": "ContactPoint",
      contactType: "customer service",
      telephone: TELEPHONE,
      email: SITE_CONTACT.email,
      areaServed: "US",
      availableLanguage: ["English"],
    },
  };
}

export type FaqEntry = { question: string; answer: string };

/** FAQ blocks already exist on most service pages; this exposes them to Google. */
export function faqPageJsonLd(items: readonly FaqEntry[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map(({ question, answer }) => ({
      "@type": "Question",
      name: question,
      acceptedAnswer: { "@type": "Answer", text: answer },
    })),
  };
}

export type ServiceOffer = {
  /** Lowest published price, in USD. */
  price: number;
  /** "per person" prices use Offer; group rates are still the entry price. */
  description?: string;
};

/**
 * One sellable service (a tour or a transportation product), tied back to the
 * business node so Google reads them as the same entity.
 */
export function serviceJsonLd(params: {
  name: string;
  description: string;
  path: string;
  serviceType: string;
  offer?: ServiceOffer;
}) {
  const { name, description, path, serviceType, offer } = params;
  return {
    "@context": "https://schema.org",
    "@type": "Service",
    name,
    description,
    serviceType,
    url: absoluteUrl(path),
    provider: { "@id": BUSINESS_ID },
    areaServed: [
      { "@type": "City", name: "Anaheim" },
      { "@type": "City", name: "Los Angeles" },
    ],
    ...(offer
      ? {
          offers: {
            "@type": "Offer",
            price: String(offer.price),
            priceCurrency: "USD",
            availability: "https://schema.org/InStock",
            url: absoluteUrl(path),
            ...(offer.description ? { description: offer.description } : {}),
          },
        }
      : {}),
  };
}
