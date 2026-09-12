import type { Metadata } from "next";
import { Cormorant, Montserrat, Geist } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import { publicUrl } from "@/lib/publicPath";
import { IS_BETA, SITE_URL } from "@/lib/siteEnv";
import { cn } from "@/lib/utils";
import BetaBanner from "@/components/BetaBanner";
import ConversionListeners from "@/components/analytics/ConversionListeners";
import { GA4_MEASUREMENT_ID, GOOGLE_ADS_ID } from "@/lib/analytics/conversions";
import JsonLd from "@/components/seo/JsonLd";
import { localBusinessJsonLd } from "@/lib/seo/jsonLd";

const geist = Geist({ subsets: ["latin"], variable: "--font-sans" });

const cormorant = Cormorant({
  subsets: ["latin"],
  variable: "--font-cormorant",
  weight: ["400", "500", "600", "700"],
  style: ["normal", "italic"],
  display: "swap",
});

const montserrat = Montserrat({
  subsets: ["latin"],
  variable: "--font-montserrat",
  weight: ["300", "400", "500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  alternates: { canonical: "/" },
  title: "TNT Tours | Anaheim's Premier Tours & Transportation Service",
  description:
    "Anaheim airport transportation, Disneyland transportation, LA tours, private tours, and group transportation across Southern California. LAX, SNA, Long Beach, Burbank, Ontario, and San Diego airport transfers. 5-star rated on Google & TripAdvisor.",
  keywords:
    "Anaheim tours and transportation, Anaheim airport transportation, Disneyland transportation, LAX to Anaheim transportation, SNA to Disneyland transportation, private tours Anaheim, LA tours from Anaheim, group transportation Anaheim, Anaheim hotel transportation, Southern California tours and transportation",
  // Beta deployments must not be indexed — they share copy with prod and would
  // create duplicate-content SEO issues on the real domain.
  robots: IS_BETA
    ? { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } }
    : { index: true, follow: true },
  openGraph: {
    title: "TNT Tours | Anaheim's Premier Tours & Transportation Service",
    description:
      "Airport transfers, Disneyland transportation, LA tours, private tours, and group transportation across Southern California — from one trusted local team in Anaheim.",
    type: "website",
    url: SITE_URL,
    images: [{ url: publicUrl("/tnt-tours-logo.png"), width: 1254, height: 1254, alt: "TNT Tours & Transportation" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "TNT Tours | Anaheim's Premier Tours & Transportation Service",
    description:
      "Airport transfers, Disneyland transportation, LA tours, private tours, and group transportation across Southern California \u2014 from one trusted local team in Anaheim.",
    images: [publicUrl("/tnt-tours-logo.png")],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      data-scroll-behavior="smooth"
      className={cn("h-full", "antialiased", cormorant.variable, montserrat.variable, "font-sans", geist.variable)}
    >
      <body className="min-h-full flex flex-col bg-cream text-ink">
        {/* Who we are, where we operate, how to reach us — stated once for the
            whole site so search engines don't have to infer it from prose. */}
        <JsonLd data={localBusinessJsonLd()} />
        {/* Google tag — production only. One gtag.js load, two destinations:
            Google Ads (conversions) and GA4 (traffic + behaviour).
            On beta, test traffic would inflate impressions and pollute both. */}
        {!IS_BETA && (
          <>
            <Script
              src={`https://www.googletagmanager.com/gtag/js?id=${GOOGLE_ADS_ID}`}
              strategy="afterInteractive"
            />
            <Script id="google-gtag" strategy="afterInteractive">
              {`
                window.dataLayer = window.dataLayer || [];
                function gtag(){dataLayer.push(arguments);}
                gtag('js', new Date());
                gtag('config', '${GOOGLE_ADS_ID}');
                gtag('config', '${GA4_MEASUREMENT_ID}');
              `}
            </Script>
          </>
        )}
        {/* Delegated tracking for tel: and Peek links. Safe on beta: the
            helpers no-op when the Google tag isn't on the page. */}
        <ConversionListeners />
        {children}
        {IS_BETA && <BetaBanner />}
      </body>
    </html>
  );
}
