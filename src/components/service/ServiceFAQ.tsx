"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { stagger, fadeUp, viewport } from "@/lib/motionVariants";
import Link from "next/link";
import JsonLd from "@/components/seo/JsonLd";
import { faqPageJsonLd } from "@/lib/seo/jsonLd";

export type FAQItem = { question: string; answer: string };

type Props = {
  items: FAQItem[];
  heading?: string;
};

function FAQRow({ q, a, isOpen, onClick }: { q: string; a: string; isOpen: boolean; onClick: () => void }) {
  return (
    <div className="border-b border-border last:border-b-0">
      <button
        className="w-full flex items-start gap-4 py-5 text-left cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-gold rounded-sm"
        onClick={onClick}
        aria-expanded={isOpen}
      >
        <span className={`mt-0.5 shrink-0 w-6 h-6 rounded-full border flex items-center justify-center transition-colors duration-200 ${isOpen ? "border-gold bg-gold/10 text-gold" : "border-border text-muted"}`} aria-hidden="true">
          <svg className={`w-3.5 h-3.5 transition-transform duration-300 ${isOpen ? "rotate-45" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
        </span>
        <span className="font-display text-lg font-medium text-ink flex-1 pr-4">{q}</span>
      </button>
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            key="answer"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <p className="pl-10 pb-5 pr-4 font-sans text-muted text-base leading-relaxed">{a}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function ServiceFAQ({ items, heading = "Frequently Asked Questions" }: Props) {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <section className="py-20 bg-sand" aria-label="Frequently asked questions">
      {/* Answers are collapsed behind a click; this is how a crawler reads them. */}
      <JsonLd data={faqPageJsonLd(items)} />
      <div className="max-w-7xl mx-auto px-5 sm:px-8 lg:px-12">
        <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-12">
          <motion.div variants={fadeUp} initial="hidden" whileInView="show" viewport={viewport} className="lg:sticky lg:top-28 self-start">
            <div className="inline-flex items-center gap-2.5 mb-4">
              <hr className="gold-rule" aria-hidden="true" />
              <span className="font-sans text-xs font-semibold tracking-[0.18em] text-gold uppercase">FAQ</span>
            </div>
            <h2 className="font-display text-3xl md:text-4xl font-semibold text-ink leading-tight">
              {heading}
            </h2>
            <p className="mt-4 font-sans text-muted text-sm leading-relaxed">
              Can&apos;t find your answer? We&apos;re happy to help.
            </p>
            <Link href="/#contact" className="mt-5 inline-flex items-center gap-2 font-sans text-sm font-medium text-gold hover:text-gold-dark transition-colors">
              Contact us directly
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
              </svg>
            </Link>
          </motion.div>

          <motion.div variants={stagger} initial="hidden" whileInView="show" viewport={viewport}
            className="bg-white rounded-3xl border border-border px-6 sm:px-8 divide-y divide-border">
            {items.map((item, i) => (
              <motion.div key={item.question} variants={fadeUp}>
                <FAQRow
                  q={item.question}
                  a={item.answer}
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
