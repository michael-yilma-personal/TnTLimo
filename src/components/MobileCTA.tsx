"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { PEEK_BOOKING_URL } from "@/lib/siteBooking";
import { SITE_CONTACT } from "@/lib/siteContact";

export default function MobileCTA() {
  const [visible, setVisible] = useState(false);

  /**
   * Tours check out on Peek; transportation checks out on the on-site wizard.
   * The home page sells both, so its bar offers both and Call shrinks to an
   * icon to make room. The tour pages keep Call + a single tour button — same
   * route-follows-product rule as the header CTA.
   */
  const isHome = (usePathname() ?? "/") === "/";

  useEffect(() => {
    const handleScroll = () => {
      // Show after scrolling past the hero (~80vh)
      setVisible(window.scrollY > window.innerHeight * 0.8);
    };
    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 80, opacity: 0 }}
          transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
          className="fixed bottom-0 left-0 right-0 z-40 lg:hidden pb-[env(safe-area-inset-bottom)]"
          aria-label="Mobile booking bar"
        >
          <div className="bg-white/95 backdrop-blur-md border-t border-border px-4 py-3 flex items-center gap-2.5 shadow-[0_-4px_20px_rgba(12,11,10,0.08)]">
            {/* Call — fast path */}
            <Link
              href={SITE_CONTACT.phoneHref}
              aria-label={`Call TNT Tours at ${SITE_CONTACT.phoneDisplay}`}
              className={`shrink-0 inline-flex items-center justify-center gap-1.5 border border-border bg-white text-ink font-sans text-sm font-semibold rounded-full transition-colors duration-200 hover:bg-sand active:scale-[0.97] cursor-pointer focus:outline-none focus:ring-2 focus:ring-ink focus:ring-offset-2 ${
                isHome ? "h-12 w-12" : "px-4 py-3"
              }`}
            >
              <svg
                className="w-4 h-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.948V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
                />
              </svg>
              {!isHome && "Call"}
            </Link>

            {/* Ride — on-site wizard. Solid gold: it books and pays here. */}
            {isHome && (
              <Link
                href="/transportation/book"
                className="flex-1 inline-flex items-center justify-center h-12 px-3 bg-gold text-ink font-sans text-sm font-bold rounded-full whitespace-nowrap transition-colors duration-200 hover:bg-gold-dark active:scale-[0.97] cursor-pointer focus:outline-none focus:ring-2 focus:ring-gold focus:ring-offset-2"
              >
                Book a Ride
              </Link>
            )}

            {/* Tour — Peek checkout. Primary on tour pages, outlined on home. */}
            <Link
              href={PEEK_BOOKING_URL}
              target="_blank"
              rel="noopener noreferrer"
              className={
                isHome
                  ? "flex-1 inline-flex items-center justify-center h-12 px-3 border border-ink/80 bg-white text-ink font-sans text-sm font-bold rounded-full whitespace-nowrap transition-colors duration-200 hover:bg-sand active:scale-[0.97] cursor-pointer focus:outline-none focus:ring-2 focus:ring-ink focus:ring-offset-2"
                  : "flex-1 inline-flex items-center justify-center gap-1.5 px-5 py-3 bg-gold text-ink font-sans text-sm font-bold rounded-full transition-colors duration-200 hover:bg-gold-dark active:scale-[0.97] cursor-pointer focus:outline-none focus:ring-2 focus:ring-gold focus:ring-offset-2"
              }
            >
              {isHome ? "Book a Tour" : "Book Now"}
              <svg
                className={isHome ? "hidden" : "w-3.5 h-3.5"}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2.5}
                aria-hidden="true"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
              </svg>
            </Link>
          </div>

          {/* Tiny trust line under bar */}
          <div className="bg-white/95 backdrop-blur-md border-t border-border/60 px-4 py-1.5 flex items-center justify-center gap-1.5">
            <div className="flex items-center gap-0.5" aria-hidden="true">
              {[...Array(5)].map((_, i) => (
                <svg key={i} className="w-3 h-3 fill-gold" viewBox="0 0 20 20">
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
              ))}
            </div>
            <span className="font-sans text-[11px] text-muted">5.0 · 500+ guests · Hotel pickup available</span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
