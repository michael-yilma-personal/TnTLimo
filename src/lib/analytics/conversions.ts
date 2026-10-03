/**
 * Google Ads conversion tracking.
 *
 * The Google tag (AW-1015360162 for Ads, G-N47WY0K4S9 for GA4) is loaded in
 * `src/app/layout.tsx`, production only — on beta there is no `gtag` on the
 * page, so every call in here is a silent no-op and beta traffic never
 * pollutes the account.
 *
 * Every conversion action below is a "manual event" action in Google Ads
 * (Goals > Conversions). Nothing fires unless we call it explicitly, which is
 * deliberate: Google's automatic form detection can't see our contact form
 * (it is rendered client-side and submitted with `preventDefault()` + `fetch`,
 * so there is no navigation for the tag to latch onto).
 *
 * Labels are the `send_to` values from each action's event snippet. They are
 * stable for the life of the conversion action; if an action is deleted and
 * recreated in Google Ads, the label changes and must be updated here.
 */

/** Google Ads account tag id. Also consumed by the loader in `src/app/layout.tsx`. */
export const GOOGLE_ADS_ID = "AW-1015360162";

/**
 * GA4 measurement id for the "TNT Tours & Transportation" property.
 * Loaded by the same gtag.js tag as the Ads id in `src/app/layout.tsx`: one
 * script, two `config` destinations. GA4 sees pageviews and enhanced
 * measurement; conversions are still reported to Ads from this file, so there
 * is no GA4-imported duplicate of the purchase event.
 */
export const GA4_MEASUREMENT_ID = "G-N47WY0K4S9";

export const CONVERSION_LABELS = {
  /** Paid transportation booking — fires on /booking/success with real revenue. */
  bookingPurchase: `${GOOGLE_ADS_ID}/XBw8CP6mrPUcEKLVlOQD`,
  /** Contact form on the marketing site, counted only once delivery succeeds. */
  contactFormSubmit: `${GOOGLE_ADS_ID}/9uvKCPmnrPUcEKLVlOQD`,
  /** Wizard's 15+ passenger / custom-quote path (email, no online checkout). */
  customQuoteRequest: `${GOOGLE_ADS_ID}/qXJYCNvEsPUcEKLVlOQD`,
  /** Any tap on a `tel:` link anywhere on the site. */
  phoneNumberClick: `${GOOGLE_ADS_ID}/WS9BCN7EsPUcEKLVlOQD`,
  /** Click through to Peek tour checkout. Secondary in Google Ads — see below. */
  peekTourBookingClick: `${GOOGLE_ADS_ID}/mjPqCOHEsPUcEKLVlOQD`,
} as const;

type GtagFn = (command: string, ...args: unknown[]) => void;

declare global {
  interface Window {
    gtag?: GtagFn;
  }
}

function gtag(): GtagFn | null {
  if (typeof window === "undefined") return null;
  return typeof window.gtag === "function" ? window.gtag : null;
}

/**
 * Fire a conversion. Never throws: a tracking failure must not break a booking
 * confirmation or a form submission.
 */
function trackConversion(sendTo: string, params: Record<string, unknown> = {}): void {
  const g = gtag();
  if (!g) return;
  try {
    g("event", "conversion", { send_to: sendTo, ...params });
  } catch {
    // Swallow — analytics is never load-bearing.
  }
}

/**
 * Enhanced conversions. The account has "Enhanced conversions managed through
 * Google Tag" switched on and the customer data terms accepted, so passing
 * hashed-on-Google's-side identifiers materially improves match rates for the
 * one event where we actually hold them: a completed booking.
 */
function setUserData(email?: string | null, phone?: string | null): void {
  const g = gtag();
  if (!g) return;
  const userData: Record<string, string> = {};
  if (email) userData.email = email.trim().toLowerCase();
  // Google expects E.164. Our wizard collects free-form US numbers, so only
  // send it when it already looks E.164 rather than guessing a country code.
  if (phone && /^\+[1-9]\d{7,14}$/.test(phone.trim())) {
    userData.phone_number = phone.trim();
  }
  if (Object.keys(userData).length === 0) return;
  try {
    g("set", "user_data", userData);
  } catch {
    // Ignore.
  }
}

/** Guards against double-counting when a customer refreshes a success page. */
function firedOnce(key: string): boolean {
  try {
    if (window.sessionStorage.getItem(key) !== null) return false;
    window.sessionStorage.setItem(key, "1");
    return true;
  } catch {
    // Private mode / blocked storage: fall through and fire. Google dedupes
    // server-side on transaction_id for the purchase event, which is the only
    // place a repeat actually matters.
    return true;
  }
}

export interface BookingPurchaseArgs {
  /** Confirmation code — also sent as `transaction_id` so Google can dedupe. */
  transactionId: string;
  /** Order total in USD (not cents). */
  valueUsd: number;
  email?: string | null;
  phone?: string | null;
}

export function trackBookingPurchase({
  transactionId,
  valueUsd,
  email,
  phone,
}: BookingPurchaseArgs): void {
  if (!gtag()) return;
  if (!firedOnce(`gads:purchase:${transactionId}`)) return;
  setUserData(email, phone);
  trackConversion(CONVERSION_LABELS.bookingPurchase, {
    value: valueUsd,
    currency: "USD",
    transaction_id: transactionId,
  });
}

export function trackContactFormSubmit(): void {
  trackConversion(CONVERSION_LABELS.contactFormSubmit);
}

export function trackCustomQuoteRequest(): void {
  trackConversion(CONVERSION_LABELS.customQuoteRequest);
}

export function trackPhoneNumberClick(): void {
  trackConversion(CONVERSION_LABELS.phoneNumberClick);
}

export function trackPeekTourBookingClick(): void {
  trackConversion(CONVERSION_LABELS.peekTourBookingClick);
}

/**
 * Step-by-step progress through the 5-step transportation booking wizard.
 *
 * This is a GA4 event, NOT a Google Ads conversion: it is diagnostic, and
 * routing it to Ads would let Smart Bidding chase people who merely start a
 * form. It answers the question the conversion data cannot — of the visitors
 * who reach the wizard and never finish, which step loses them.
 *
 * `reached` fires once per step per session so a customer stepping back and
 * forth is counted as one visit to that step, which is what a funnel needs.
 */
export function trackBookingStep(step: number, label: string): void {
  const g = gtag();
  if (!g) return;
  if (!firedOnce(`ga4:booking_step:${step}`)) return;
  try {
    g("event", "booking_step", {
      send_to: GA4_MEASUREMENT_ID,
      step_number: step,
      step_name: label,
    });
  } catch {
    // Swallow — analytics is never load-bearing.
  }
}

/**
 * The customer left the wizard for Stripe Checkout. Paired with
 * `trackBookingPurchase` on the success page, the gap between the two is the
 * payment-abandonment rate — the step we currently cannot see at all.
 */
export function trackCheckoutRedirect(valueUsd: number | null): void {
  const g = gtag();
  if (!g) return;
  try {
    g("event", "begin_checkout", {
      send_to: GA4_MEASUREMENT_ID,
      currency: "USD",
      ...(valueUsd === null ? {} : { value: valueUsd }),
    });
  } catch {
    // Swallow — analytics is never load-bearing.
  }
}
