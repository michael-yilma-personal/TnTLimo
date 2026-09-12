"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { stagger, fadeUp, viewport } from "@/lib/motionVariants";
import { SITE_CONTACT } from "@/lib/siteContact";
import JsonLd from "@/components/seo/JsonLd";
import { faqPageJsonLd } from "@/lib/seo/jsonLd";

const faqs = [
  {
    question: "Where does the Best of LA & Hollywood Tour start?",
    answer:
      "The Best of LA & Hollywood Tour departs from the Anaheim area. We offer hotel pickup for guests staying at Anaheim-area hotels and resorts — making it especially convenient if you're visiting Disneyland or the surrounding area. We'll confirm your exact pickup location when you book.",
  },
  {
    question: "Is hotel pickup available?",
    answer:
      "Yes. For the Best of LA & Hollywood Tour from Anaheim, we offer pickup directly from your hotel or resort in the Anaheim area. Private tours can be arranged with a pickup point in Los Angeles or Orange County that works best for your group.",
  },
  {
    question: "Is the private tour customizable?",
    answer:
      "Absolutely. The Private LA Hollywood Tour is fully tailored to your group. You can tell us which neighborhoods, landmarks, or experiences matter most to you, and we'll build the day around your preferences. Not sure what you'd like to see? We're happy to recommend an itinerary.",
  },
  {
    question: "Does Universal Studios Transportation include roundtrip service?",
    answer:
      "Yes — the Universal Studios Transportation is a full roundtrip service. We pick you up in Anaheim, drop you off at Universal Studios Hollywood, and bring you back at the end of the day. No parking, no freeway stress, no problem.",
  },
  {
    question: "Are these experiences family-friendly?",
    answer:
      "Very much so. We regularly host families with young children, and our tours are designed to be welcoming for all ages. If you have specific needs for your group — young kids, elderly guests, special occasions — just let us know and we'll make sure everything is taken care of.",
  },
  {
    question: "How do I book?",
    answer: `Use Book Now anywhere on this site — it opens our secure checkout on Peek in a new tab. Prefer to talk first? Call us at ${SITE_CONTACT.phoneDisplay} or email ${SITE_CONTACT.email} — we're happy to answer questions before you book.`,
  },
  {
    question: "What is your cancellation policy?",
    answer:
      "We understand that travel plans can change. Please reach out to us directly for full details on our cancellation and rescheduling policy — we do our best to be flexible and accommodating for our guests.",
  },
  {
    question: "How many people can join the group tour?",
    answer:
      "We intentionally keep our group sizes small so every guest gets a personal, attentive experience. For larger groups or more flexibility, the Private LA Hollywood Tour is ideal — the vehicle and itinerary are dedicated entirely to your party.",
  },
];

function FAQItem({ q, a, isOpen, onClick }: { q: string; a: string; isOpen: boolean; onClick: () => void }) {
  return (
    <div className="border-b border-border last:border-b-0">
      <button
        className="w-full flex items-start gap-4 py-6 text-left cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 rounded-sm"
        onClick={onClick}
        aria-expanded={isOpen}
      >
        <span
          className={`mt-0.5 shrink-0 w-6 h-6 rounded-full border flex items-center justify-center transition-colors duration-200 ${
            isOpen ? "border-gold bg-gold/10 text-gold" : "border-border text-muted"
          }`}
          aria-hidden="true"
        >
          <svg
            className={`w-3.5 h-3.5 transition-transform duration-300 ${isOpen ? "rotate-45" : "rotate-0"}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2.5}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
        </span>
        <span className="font-display text-lg font-medium text-ink flex-1 pr-4">
          {q}
        </span>
      </button>

      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            key="answer"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <p className="pl-10 pb-6 pr-4 font-sans text-muted text-base leading-relaxed">
              {a}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function FAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <section id="faq" className="py-24 bg-sand" aria-label="Frequently asked questions">
      {/* Answers are collapsed behind a click; this is how a crawler reads them. */}
      <JsonLd data={faqPageJsonLd(faqs)} />
      <div className="max-w-7xl mx-auto px-5 sm:px-8 lg:px-12">
        <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-16">
          {/* Left: Header */}
          <motion.div
            variants={fadeUp}
            initial="hidden"
            whileInView="show"
            viewport={viewport}
            className="lg:sticky lg:top-28 self-start"
          >
            <div className="inline-flex items-center gap-2.5 mb-4">
              <hr className="gold-rule" aria-hidden="true" />
              <span className="font-sans text-xs font-semibold tracking-[0.18em] text-gold uppercase">
                FAQ
              </span>
            </div>
            <h2 className="font-display text-4xl md:text-5xl font-semibold text-ink leading-tight">
              Questions?<br />
              <span className="text-gold">We Have Answers.</span>
            </h2>
            <p className="mt-5 font-sans text-muted text-base leading-relaxed">
              Everything you need to know before booking. Still have something
              on your mind?
            </p>
            <a
              href="#contact"
              className="mt-6 inline-flex items-center gap-2 font-sans text-sm font-medium text-gold hover:text-gold-dark transition-colors cursor-pointer"
            >
              Contact us directly
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
              </svg>
            </a>
          </motion.div>

          {/* Right: Accordion */}
          <motion.div
            variants={stagger}
            initial="hidden"
            whileInView="show"
            viewport={viewport}
            className="bg-white rounded-3xl border border-border px-6 sm:px-8 divide-y divide-border"
          >
            {faqs.map((faq, i) => (
              <motion.div key={faq.question} variants={fadeUp}>
                <FAQItem
                  q={faq.question}
                  a={faq.answer}
                  isOpen={openIndex === i}
                  onClick={() => setOpenIndex(openIndex === i ? null : i)}
                />
              </motion.div>
            ))}
          </motion.div>
        </div>
      </div>
    </section>
  );
}
