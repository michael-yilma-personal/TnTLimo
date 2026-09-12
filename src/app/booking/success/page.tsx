import Link from "next/link";
import { eq } from "drizzle-orm";
import BookingConversion from "./BookingConversion";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { db } from "@/lib/booking/db";
import { bookings } from "@/lib/booking/schema";
import { signManageToken } from "@/lib/booking/manageToken";
import { getTenant } from "@/lib/tenant";

const tenant = getTenant();

export const metadata = {
  title: `Booking confirmed · ${tenant.shortName}`,
  robots: { index: false, follow: false },
};

// This page reads from the DB to look up the booking by Stripe session id.
// Force dynamic rendering so it doesn't try to prerender at build time.
export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ session_id?: string }>;
}

export default async function BookingSuccessPage({ searchParams }: PageProps) {
  const { session_id } = await searchParams;

  let booking: typeof bookings.$inferSelect | undefined;
  if (session_id) {
    [booking] = await db
      .select()
      .from(bookings)
      .where(eq(bookings.stripeSessionId, session_id))
      .limit(1);
  }

  return (
    <>
      <Header solid />
      <main className="bg-cream text-ink min-h-screen pt-20 md:pt-24 pb-24">
        <div className="max-w-2xl mx-auto px-5 sm:px-8">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gold/15 mb-5">
              <svg className="w-8 h-8 text-gold" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h1 className="font-display text-3xl md:text-4xl font-semibold text-ink leading-tight">
              You&apos;re booked.
            </h1>
            <p className="mt-3 font-sans text-muted leading-relaxed">
              {booking
                ? `Confirmation ${booking.confirmationCode} — we'll email full details to ${booking.customerEmail} shortly.`
                : "We're confirming your booking. You'll get an email with your confirmation number and details in a moment."}
            </p>
          </div>

          {booking && (
            <BookingConversion
              transactionId={booking.confirmationCode}
              valueUsd={booking.totalCents / 100}
              email={booking.customerEmail}
              phone={booking.customerPhone}
            />
          )}

          {booking && (
            <div className="rounded-3xl border border-border bg-white p-6 sm:p-8 shadow-[0_4px_16px_-6px_rgba(12,11,10,0.10)]">
              <div className="flex justify-between items-start gap-4 pb-4 border-b border-border">
                <div>
                  <p className="font-sans text-xs font-semibold uppercase tracking-[0.18em] text-muted">
                    Confirmation
                  </p>
                  <p className="mt-1 font-display text-2xl font-semibold text-ink">
                    {booking.confirmationCode}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-sans text-xs font-semibold uppercase tracking-[0.18em] text-muted">
                    Status
                  </p>
                  <p className="mt-1 inline-flex items-center gap-1.5 font-sans text-sm font-semibold text-green-700">
                    <span
                      className="inline-block w-1.5 h-1.5 rounded-full bg-green-600"
                      aria-hidden="true"
                    />
                    {booking.status === "confirmed" ? "Confirmed" : "Processing"}
                  </p>
                </div>
              </div>
              <dl className="mt-5 space-y-3 font-sans text-sm">
                <div className="flex justify-between gap-4">
                  <dt className="text-muted">Service</dt>
                  <dd className="font-medium text-ink text-right">{booking.serviceLabel}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-muted">Pickup</dt>
                  <dd className="font-medium text-ink text-right">
                    {new Intl.DateTimeFormat("en-US", {
                      dateStyle: "medium",
                      timeStyle: "short",
                      timeZone: "America/Los_Angeles",
                    }).format(new Date(booking.pickupAt))}{" "}
                    PT
                  </dd>
                </div>
                <div className="flex justify-between gap-4 pt-3 border-t border-border">
                  <dt className="font-semibold text-ink">Total paid</dt>
                  <dd className="font-display text-xl font-semibold text-ink">
                    ${(booking.totalCents / 100).toFixed(2)}
                  </dd>
                </div>
              </dl>

              <div className="mt-6 pt-5 border-t border-border">
                <Link
                  href={`/booking/${booking.confirmationCode}?t=${encodeURIComponent(signManageToken(booking.id))}`}
                  className="inline-flex items-center gap-2 font-sans text-sm font-semibold text-gold hover:text-gold-dark transition-colors"
                >
                  Manage your booking
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
                  </svg>
                </Link>
              </div>
            </div>
          )}

          <div className="mt-8 rounded-2xl border border-border bg-cream p-5 text-sm text-muted leading-relaxed space-y-2">
            <p>
              <span className="font-semibold text-ink">Need to cancel?</span> You can cancel for a
              full refund up to <span className="font-semibold text-ink">24 hours before pickup</span>.
              Use the "Manage your booking" link in your confirmation email, or contact us directly.
            </p>
            <p>
              <span className="font-semibold text-ink">Need to change your pickup time or address?</span>{" "}
              Cancel and rebook, or call us and we'll adjust it for you.
            </p>
            <p>
              Questions? Email{" "}
              <a href={`mailto:${tenant.supportEmail}`} className="text-gold hover:underline">
                {tenant.supportEmail}
              </a>{" "}
              or call{" "}
              <a href={tenant.supportPhone.href} className="text-gold hover:underline">
                {tenant.supportPhone.display}
              </a>.
            </p>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
