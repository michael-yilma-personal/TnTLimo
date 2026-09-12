"use client";

import { useEffect } from "react";
import {
  trackPeekTourBookingClick,
  trackPhoneNumberClick,
} from "@/lib/analytics/conversions";
import { PEEK_BOOKING_URL } from "@/lib/siteBooking";

/**
 * Site-wide click tracking for the two conversions that have no single owning
 * component.
 *
 * `tel:` links appear in Header (x3), Footer, MobileCTA, ContactSection, the
 * booking wizard and the booking-management pages — a dozen call sites using a
 * mix of `<a>` and `next/link`. One delegated listener covers all of them and
 * keeps future phone links tracked for free.
 *
 * Peek is the same story: the tour checkout link is rendered from seven
 * components. Note it is a *secondary* action in Google Ads — an outbound click
 * is intent, not revenue, and we don't want Smart Bidding chasing it.
 *
 * Capture phase, so we run before anything calls `stopPropagation()`. Both link
 * types keep the page alive (Peek opens in a new tab, `tel:` hands off to the
 * OS), so the beacon has time to leave.
 */
export default function ConversionListeners() {
  useEffect(() => {
    function onClick(event: MouseEvent) {
      const target = event.target;
      if (!(target instanceof Element)) return;

      const anchor = target.closest("a[href]");
      if (!(anchor instanceof HTMLAnchorElement)) return;

      const href = anchor.getAttribute("href") ?? "";
      if (href.startsWith("tel:")) {
        trackPhoneNumberClick();
      } else if (href.startsWith(PEEK_BOOKING_URL)) {
        trackPeekTourBookingClick();
      }
    }

    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  return null;
}
