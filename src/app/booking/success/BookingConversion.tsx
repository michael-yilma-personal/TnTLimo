"use client";

import { useEffect } from "react";
import { trackBookingPurchase } from "@/lib/analytics/conversions";

interface BookingConversionProps {
  transactionId: string;
  valueUsd: number;
  email?: string | null;
  phone?: string | null;
}

/**
 * Fires the Google Ads purchase conversion for a completed booking.
 *
 * The success page itself is a Server Component (it reads the booking out of
 * the DB by Stripe session id), so the conversion needs this client island.
 * Rendering it only when a booking row was found means we never report revenue
 * for a session Stripe hasn't confirmed yet.
 *
 * Customers arrive here redirected back from Stripe Checkout — same origin, so
 * the `_gcl_aw` cookie survives the round trip and the click attributes
 * normally. No cross-domain measurement setup needed.
 */
export default function BookingConversion({
  transactionId,
  valueUsd,
  email,
  phone,
}: BookingConversionProps) {
  useEffect(() => {
    trackBookingPurchase({ transactionId, valueUsd, email, phone });
  }, [transactionId, valueUsd, email, phone]);

  return null;
}
