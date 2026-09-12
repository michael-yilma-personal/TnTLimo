"use client";

import { useState, type FormEvent } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { fadeUp, viewport } from "@/lib/motionVariants";
import { trackContactFormSubmit } from "@/lib/analytics/conversions";
import { SITE_CONTACT } from "@/lib/siteContact";

export default function ContactSection() {
  const [status, setStatus] = useState<"idle" | "sending" | "success" | "error">("idle");

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus("sending");
    const form = e.currentTarget;
    const fd = new FormData(form);
    try {
      // Delivered through our own Resend-backed endpoint — no third-party form
      // service, and never a full-page navigation that could strand the user on
      // an external error page.
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: fd.get("name"),
          email: fd.get("email"),
          phone: fd.get("phone") || "",
          message: fd.get("message"),
          _honey: fd.get("_honey") || "",
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean };
      if (res.ok && data.ok) {
        setStatus("success");
        // Counted on delivery, not on click — a failed send isn't a lead.
        trackContactFormSubmit();
        form.reset();
      } else {
        setStatus("error");
      }
    } catch {
      setStatus("error");
    }
  }

  const inputClass =
    "w-full rounded-xl border border-border bg-white px-4 py-3 font-sans text-sm text-ink placeholder:text-muted transition-[border-color,box-shadow] duration-200 ease-out focus:outline-none focus:ring-2 focus:ring-gold/40 focus:border-gold";

  return (
    <section
      id="contact"
      className="py-24 bg-cream border-t border-border"
      aria-label="Contact TNT Tours"
    >
      <div className="max-w-7xl mx-auto px-5 sm:px-8 lg:px-12">
        <motion.div
          variants={fadeUp}
          initial="hidden"
          whileInView="show"
          viewport={viewport}
          className="text-center mb-12"
        >
          <div className="inline-flex items-center gap-2.5 mb-4">
            <hr className="gold-rule" aria-hidden="true" />
            <span className="font-sans text-xs font-semibold tracking-[0.18em] text-gold uppercase">
              Get in Touch
            </span>
            <hr className="gold-rule" aria-hidden="true" />
          </div>
          <h2 className="font-display text-4xl md:text-5xl font-semibold text-ink">
            Send Us a Question
          </h2>
          <p className="mt-4 font-sans text-muted max-w-xl mx-auto leading-relaxed">
            Ask about tours, pickup, group size, or anything else. We&apos;ll reply by email as soon as we can.
            You can also call{" "}
            <a href={SITE_CONTACT.phoneHref} className="text-gold hover:underline">
              {SITE_CONTACT.phoneDisplay}
            </a>{" "}
            or email{" "}
            <a href={`mailto:${SITE_CONTACT.email}`} className="text-gold hover:underline">
              {SITE_CONTACT.email}
            </a>
            .
          </p>
        </motion.div>

        <motion.div
          variants={fadeUp}
          initial="hidden"
          whileInView="show"
          viewport={viewport}
          className="max-w-xl mx-auto"
        >
          <form onSubmit={onSubmit} className="space-y-4">
            {/* Honeypot — hidden from users; bots that fill it are dropped server-side. */}
            <input
              type="text"
              name="_honey"
              tabIndex={-1}
              autoComplete="off"
              aria-hidden="true"
              style={{ display: "none" }}
            />
            <div>
              <label htmlFor="contact-name" className="block font-sans text-xs font-semibold text-muted uppercase tracking-wide mb-1.5">
                Name
              </label>
              <input id="contact-name" name="name" type="text" required autoComplete="name" className={inputClass} />
            </div>
            <div>
              <label htmlFor="contact-email" className="block font-sans text-xs font-semibold text-muted uppercase tracking-wide mb-1.5">
                Email
              </label>
              <input id="contact-email" name="email" type="email" required autoComplete="email" className={inputClass} />
            </div>
            <div>
              <label htmlFor="contact-phone" className="block font-sans text-xs font-semibold text-muted uppercase tracking-wide mb-1.5">
                Phone <span className="font-normal normal-case text-muted/70">(optional)</span>
              </label>
              <input id="contact-phone" name="phone" type="tel" autoComplete="tel" className={inputClass} />
            </div>
            <div>
              <label htmlFor="contact-message" className="block font-sans text-xs font-semibold text-muted uppercase tracking-wide mb-1.5">
                Message
              </label>
              <textarea
                id="contact-message"
                name="message"
                required
                rows={5}
                className={`${inputClass} resize-y min-h-[120px]`}
                placeholder="How can we help?"
              />
            </div>
            <motion.button
              type="submit"
              disabled={status === "sending" || status === "success"}
              whileTap={status === "idle" || status === "error" ? { scale: 0.97 } : undefined}
              transition={{ duration: 0.12, ease: "easeOut" }}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-3.5 bg-ink text-white font-sans font-semibold text-sm rounded-full transition-colors duration-200 hover:bg-charcoal disabled:opacity-70 disabled:cursor-not-allowed cursor-pointer focus:outline-none focus:ring-2 focus:ring-gold focus:ring-offset-2 focus:ring-offset-cream"
            >
              <AnimatePresence mode="wait" initial={false}>
                {status === "sending" ? (
                  <motion.span
                    key="sending"
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.18 }}
                    className="inline-flex items-center gap-2"
                  >
                    <svg
                      className="w-4 h-4 animate-spin"
                      viewBox="0 0 24 24"
                      fill="none"
                      aria-hidden="true"
                    >
                      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
                      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                    </svg>
                    Sending…
                  </motion.span>
                ) : status === "success" ? (
                  <motion.span
                    key="sent"
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.18 }}
                    className="inline-flex items-center gap-2"
                  >
                    <svg
                      className="w-4 h-4"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={2.5}
                      aria-hidden="true"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                    Sent
                  </motion.span>
                ) : (
                  <motion.span
                    key="default"
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.18 }}
                  >
                    Send message
                  </motion.span>
                )}
              </AnimatePresence>
            </motion.button>
            <AnimatePresence>
              {status === "success" && (
                <motion.p
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
                  className="font-sans text-sm text-green-800 bg-green-50 border border-green-200/80 rounded-xl px-4 py-3"
                  role="status"
                >
                  Thanks — your message is on its way. We&apos;ll get back to you soon.
                </motion.p>
              )}
              {status === "error" && (
                <motion.p
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
                  className="font-sans text-sm text-red-800 bg-red-50 border border-red-200/80 rounded-xl px-4 py-3"
                  role="alert"
                >
                  Something went wrong. Please email us at {SITE_CONTACT.email} or call {SITE_CONTACT.phoneDisplay}.
                </motion.p>
              )}
            </AnimatePresence>
          </form>
        </motion.div>
      </div>
    </section>
  );
}
