"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { PEEK_BOOKING_URL } from "@/lib/siteBooking";
import { SITE_CONTACT } from "@/lib/siteContact";

type SubLink = { label: string; href: string; description?: string };

type NavLink = {
  label: string;
  href: string;
  sectionId?: string;
  children?: SubLink[];
};

const navLinks: NavLink[] = [
  { label: "Home", href: "/#home", sectionId: "home" },
  {
    label: "Transportation",
    href: "/transportation",
    children: [
      {
        label: "All transportation",
        href: "/transportation",
        description: "Overview of every service",
      },
      {
        label: "Airport Pickup & Drop-off",
        href: "/transportation/airport-transfer",
        description: "LAX, SNA, LGB, BUR, ONT, SAN",
      },
      {
        label: "Point-to-Point",
        href: "/transportation/point-to-point",
        description: "One-way private rides",
      },
      {
        label: "Hourly Charter",
        href: "/transportation/hourly-charter",
        description: "By the hour, your itinerary",
      },
    ],
  },
  {
    label: "Tours",
    href: "/#tours",
    sectionId: "tours",
    children: [
      {
        label: "All tours",
        href: "/#tours",
        description: "Browse every tour option",
      },
      {
        label: "Best of LA & Hollywood",
        href: "/los-angeles-hollywood-tour-from-anaheim",
        description: "Full-day from Anaheim",
      },
      {
        label: "Private LA Tour",
        href: "/private-los-angeles-tour",
        description: "Fully tailored to your group",
      },
      {
        label: "Universal Studios",
        href: "/universal-studios-transportation-anaheim",
        description: "Roundtrip transportation",
      },
    ],
  },
  { label: "Reviews", href: "/#reviews", sectionId: "reviews" },
  { label: "FAQ", href: "/#faq", sectionId: "faq" },
  { label: "Contact", href: "/#contact", sectionId: "contact" },
];

interface HeaderProps {
  /**
   * Force the header into its "solid" (white background, dark text) state
   * regardless of scroll position. Use on pages that don't have a dark hero
   * behind the header — without this, the white wordmark renders over cream
   * and is unreadable.
   */
  solid?: boolean;
}

export default function Header({ solid = false }: HeaderProps) {
  const reducedMotion = useReducedMotion();
  const [scrolledRaw, setScrolledRaw] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [openMobileGroup, setOpenMobileGroup] = useState<string | null>(null);

  /**
   * The header's primary button follows the product the visitor is actually
   * looking at. Tours check out on Peek; transportation checks out on the
   * on-site wizard. Sending tour traffic to the transportation form drops a
   * tour shopper into a form that cannot sell them a tour, so anything outside
   * /transportation goes to Peek — matching the hero, the in-page CTAs and the
   * mobile sticky bar, which already link there.
   */
  const pathname = usePathname();
  const headerCta = useMemo(() => {
    const isTransportation = (pathname ?? "/").startsWith("/transportation");
    return isTransportation
      ? { href: "/transportation/book", label: "Book Now", external: false }
      : { href: PEEK_BOOKING_URL, label: "Book a Tour", external: true };
  }, [pathname]);
  const dropdownTimer = useRef<number | null>(null);

  // When `solid` is true the header always behaves as if scrolled.
  const scrolled = solid || scrolledRaw;

  useEffect(() => {
    if (solid) return;
    const handleScroll = () => setScrolledRaw(window.scrollY > 32);
    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [solid]);

  // Close menu on resize to desktop
  useEffect(() => {
    const close = () => {
      if (window.innerWidth >= 1024) setMenuOpen(false);
    };
    window.addEventListener("resize", close);
    return () => window.removeEventListener("resize", close);
  }, []);

  // Lock body scroll while drawer is open
  useEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [menuOpen]);

  // Scroll-spy: track which on-page section is in view
  const sectionIds = useMemo(
    () => navLinks.map((l) => l.sectionId).filter((id): id is string => Boolean(id)),
    []
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (sectionIds.length === 0) return;
    const elements = sectionIds
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => Boolean(el));
    if (elements.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        if (visible[0]) setActiveId(visible[0].target.id);
      },
      {
        rootMargin: "-40% 0px -50% 0px",
        threshold: [0, 0.25, 0.5, 0.75, 1],
      }
    );
    elements.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [sectionIds]);

  // Dropdown open/close with small intent delay
  const handleDropdownEnter = (label: string) => {
    if (dropdownTimer.current) window.clearTimeout(dropdownTimer.current);
    setOpenDropdown(label);
  };
  const handleDropdownLeave = () => {
    if (dropdownTimer.current) window.clearTimeout(dropdownTimer.current);
    dropdownTimer.current = window.setTimeout(() => setOpenDropdown(null), 120);
  };

  return (
    <>
      <motion.header
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.55, ease: [0.23, 1, 0.32, 1] }}
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          scrolled
            ? "bg-white/95 backdrop-blur-md shadow-sm border-b border-border"
            : "bg-transparent"
        }`}
      >
        <div className="max-w-7xl mx-auto px-5 sm:px-8 lg:px-12">
          <div className="flex items-center justify-between h-16 md:h-20">
            <Link
              href="/#home"
              className="flex items-center group rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 focus-visible:ring-offset-transparent"
              aria-label="TNT Tours & Transportation — Home"
            >
              <span
                className={`font-display text-xl md:text-2xl font-semibold tracking-tight transition-colors duration-300 ${
                  scrolled ? "text-ink" : "text-white"
                }`}
              >
                TNT<span className="text-gold">Tours</span>
                <span
                  className={`text-sm md:text-base font-sans font-medium ml-1 transition-colors duration-300 ${
                    scrolled ? "text-muted" : "text-white/70"
                  }`}
                >
                  &amp; Transportation
                </span>
              </span>
            </Link>

            {/* Desktop Nav */}
            <nav
              className="hidden lg:flex items-center gap-1"
              aria-label="Main navigation"
            >
              {navLinks.map((link) => {
                const isActive = link.sectionId && activeId === link.sectionId;
                const hasDropdown = !!link.children?.length;
                const isOpen = openDropdown === link.label;
                return (
                  <div
                    key={link.label}
                    className="relative"
                    onMouseEnter={hasDropdown ? () => handleDropdownEnter(link.label) : undefined}
                    onMouseLeave={hasDropdown ? handleDropdownLeave : undefined}
                  >
                    <Link
                      href={link.href}
                      aria-current={isActive ? "page" : undefined}
                      aria-haspopup={hasDropdown || undefined}
                      aria-expanded={hasDropdown ? isOpen : undefined}
                      onFocus={hasDropdown ? () => handleDropdownEnter(link.label) : undefined}
                      className={`relative inline-flex items-center gap-1 px-3 py-2 font-sans text-sm font-medium tracking-wide transition-colors duration-200 cursor-pointer ${
                        scrolled
                          ? isActive
                            ? "text-ink"
                            : "text-muted hover:text-ink"
                          : isActive
                          ? "text-white"
                          : "text-white/80 hover:text-white"
                      }`}
                    >
                      <span className="relative z-10">{link.label}</span>
                      {hasDropdown && (
                        <svg
                          className={`relative z-10 w-3 h-3 transition-transform duration-200 ${
                            isOpen ? "rotate-180" : "rotate-0"
                          }`}
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={2.2}
                          aria-hidden="true"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                        </svg>
                      )}
                      {isActive && (
                        <motion.span
                          layoutId="nav-active-pill"
                          transition={{
                            type: "spring",
                            stiffness: 380,
                            damping: 32,
                          }}
                          className={`absolute inset-0 rounded-full ${
                            scrolled ? "bg-sand" : "bg-white/12"
                          }`}
                          aria-hidden="true"
                        />
                      )}
                    </Link>

                    {hasDropdown && (
                      <AnimatePresence>
                        {isOpen && (
                          <motion.div
                            initial={{ opacity: 0, y: 6 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 6 }}
                            transition={{ duration: 0.18, ease: [0.23, 1, 0.32, 1] }}
                            className="absolute left-0 top-full pt-2 w-72"
                            role="menu"
                          >
                            <div className="rounded-2xl border border-border bg-white shadow-[0_18px_38px_-12px_rgba(12,11,10,0.18)] overflow-hidden">
                              {link.children!.map((sub) => (
                                <Link
                                  key={sub.label}
                                  href={sub.href}
                                  role="menuitem"
                                  className="block px-4 py-3 hover:bg-sand transition-colors duration-150 border-b border-border/60 last:border-b-0"
                                >
                                  <p className="font-sans text-sm font-semibold text-ink">{sub.label}</p>
                                  {sub.description && (
                                    <p className="font-sans text-xs text-muted mt-0.5 leading-snug">
                                      {sub.description}
                                    </p>
                                  )}
                                </Link>
                              ))}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    )}
                  </div>
                );
              })}

              <Link
                href={SITE_CONTACT.phoneHref}
                className={`ml-3 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full text-sm font-sans font-medium transition-all duration-200 cursor-pointer focus:outline-none focus:ring-2 focus:ring-gold focus:ring-offset-2 focus:ring-offset-transparent ${
                  scrolled
                    ? "border border-border text-ink hover:border-ink hover:bg-sand"
                    : "border border-white/30 text-white/90 hover:border-white/70 hover:bg-white/10"
                }`}
                aria-label={`Call TNT Tours at ${SITE_CONTACT.phoneDisplay}`}
              >
                <svg
                  className="w-3.5 h-3.5"
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
                Call
              </Link>

              <motion.div
                whileHover={reducedMotion ? undefined : { scale: 1.03 }}
                whileTap={{ scale: 0.96 }}
              >
                <Link
                  href={headerCta.href}
                  target={headerCta.external ? "_blank" : undefined}
                  rel={headerCta.external ? "noopener noreferrer" : undefined}
                  className="ml-2 inline-flex items-center justify-center px-5 py-2.5 bg-gold text-ink text-sm font-semibold tracking-wide rounded-full transition-colors duration-200 hover:bg-gold-dark cursor-pointer focus:outline-none focus:ring-2 focus:ring-gold focus:ring-offset-2 focus:ring-offset-transparent"
                >
                  {headerCta.label}
                </Link>
              </motion.div>
            </nav>

            {/* Mobile actions */}
            <div className="flex items-center gap-1.5 lg:hidden">
              <Link
                href={SITE_CONTACT.phoneHref}
                aria-label={`Call TNT Tours at ${SITE_CONTACT.phoneDisplay}`}
                className={`flex items-center justify-center w-10 h-10 rounded-full transition-colors cursor-pointer ${
                  scrolled
                    ? "text-ink hover:bg-sand"
                    : "text-white hover:bg-white/10"
                }`}
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.9}
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.948V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
                  />
                </svg>
              </Link>

              <button
                className={`flex flex-col gap-1.5 p-2 cursor-pointer rounded-md transition-colors ${
                  scrolled ? "text-ink" : "text-white"
                }`}
                onClick={() => setMenuOpen((v) => !v)}
                aria-label={menuOpen ? "Close menu" : "Open menu"}
                aria-expanded={menuOpen}
              >
                <span
                  className={`block w-6 h-0.5 transition-all duration-300 origin-center ${
                    menuOpen
                      ? "rotate-45 translate-y-2 bg-ink"
                      : `${scrolled ? "bg-ink" : "bg-white"}`
                  }`}
                />
                <span
                  className={`block w-6 h-0.5 transition-all duration-300 ${
                    menuOpen ? "opacity-0" : `${scrolled ? "bg-ink" : "bg-white"}`
                  }`}
                />
                <span
                  className={`block w-6 h-0.5 transition-all duration-300 origin-center ${
                    menuOpen
                      ? "-rotate-45 -translate-y-2 bg-ink"
                      : `${scrolled ? "bg-ink" : "bg-white"}`
                  }`}
                />
              </button>
            </div>
          </div>
        </div>
      </motion.header>

      {/* Mobile Menu Drawer */}
      <AnimatePresence>
        {menuOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-40 bg-ink/60 backdrop-blur-sm lg:hidden"
              onClick={() => setMenuOpen(false)}
              aria-hidden="true"
            />
            <motion.nav
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
              className="fixed top-0 right-0 bottom-0 z-50 w-[19rem] max-w-[88vw] bg-white pt-20 pb-8 px-6 flex flex-col gap-2 lg:hidden overflow-y-auto"
              aria-label="Mobile navigation"
            >
              {navLinks.map((link, i) => {
                const isActive = link.sectionId && activeId === link.sectionId;
                const hasChildren = !!link.children?.length;
                const groupOpen = openMobileGroup === link.label;
                return (
                  <motion.div
                    key={link.label}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.04 + i * 0.04, duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
                  >
                    {hasChildren ? (
                      <>
                        <button
                          type="button"
                          onClick={() => setOpenMobileGroup(groupOpen ? null : link.label)}
                          aria-expanded={groupOpen}
                          className={`w-full flex items-center justify-between py-2 font-sans text-lg font-medium transition-colors cursor-pointer ${
                            isActive ? "text-gold" : "text-ink hover:text-gold"
                          }`}
                        >
                          {link.label}
                          <svg
                            className={`w-4 h-4 text-muted transition-transform duration-200 ${
                              groupOpen ? "rotate-180" : "rotate-0"
                            }`}
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth={2}
                            aria-hidden="true"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>
                        <AnimatePresence initial={false}>
                          {groupOpen && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: "auto", opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.22, ease: [0.23, 1, 0.32, 1] }}
                              className="overflow-hidden"
                            >
                              <div className="pl-3 my-2 border-l border-border space-y-1.5">
                                {link.children!.map((sub) => (
                                  <Link
                                    key={sub.label}
                                    href={sub.href}
                                    onClick={() => setMenuOpen(false)}
                                    className="block py-1.5 font-sans text-sm text-ink/85 hover:text-gold transition-colors"
                                  >
                                    {sub.label}
                                  </Link>
                                ))}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </>
                    ) : (
                      <Link
                        href={link.href}
                        aria-current={isActive ? "page" : undefined}
                        className={`block py-2 font-sans text-lg font-medium transition-colors cursor-pointer ${
                          isActive ? "text-gold" : "text-ink hover:text-gold"
                        }`}
                        onClick={() => setMenuOpen(false)}
                      >
                        {link.label}
                      </Link>
                    )}
                  </motion.div>
                );
              })}

              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.35, duration: 0.3 }}
                className="mt-4 flex flex-col gap-3"
              >
                <Link
                  href="/transportation/book"
                  className="block w-full text-center px-6 py-3.5 bg-gold text-ink font-semibold rounded-full transition-colors duration-200 hover:bg-gold-dark cursor-pointer"
                  onClick={() => setMenuOpen(false)}
                >
                  Book Transportation
                </Link>
                <Link
                  href={PEEK_BOOKING_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block w-full text-center px-6 py-3.5 border border-ink text-ink font-semibold rounded-full transition-colors duration-200 hover:bg-ink hover:text-white cursor-pointer"
                  onClick={() => setMenuOpen(false)}
                >
                  Book a Tour
                </Link>
                <Link
                  href={SITE_CONTACT.phoneHref}
                  className="block w-full text-center px-6 py-3.5 border border-border text-ink font-semibold rounded-full transition-colors duration-200 hover:border-ink hover:bg-sand cursor-pointer"
                  onClick={() => setMenuOpen(false)}
                >
                  Call {SITE_CONTACT.phoneDisplay}
                </Link>
              </motion.div>

              <div className="mt-auto pt-6">
                <hr className="border-border mb-4" />
                <p className="font-sans text-sm text-muted">
                  Based in Anaheim · Serving Orange County &amp; Los Angeles
                </p>
                <p className="font-sans text-sm text-gold mt-1">
                  5.0 ★ Google &amp; TripAdvisor
                </p>
              </div>
            </motion.nav>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
