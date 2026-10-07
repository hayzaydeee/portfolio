"use client";

import { useActionState } from "react";
import { motion } from "motion/react";
import { sendContact, type ContactState } from "@/app/actions/contact";
import { Cta } from "@/components/fx/ui/Cta";
import { CV_HREF } from "@/lib/rooms";
import { SectionHeading } from "./SectionHeading";

const INITIAL: ContactState = { success: false };

const FIELD =
  "w-full rounded-md border border-white/15 bg-(--lobby-surface)/40 px-3 py-2 font-sans text-sm text-(--lobby-text) backdrop-blur-sm transition-colors placeholder:text-text-muted focus:border-(--lobby-accent) focus:outline-none";

function ContactForm() {
  const [state, action, pending] = useActionState(sendContact, INITIAL);

  if (state.success) {
    return <p className="py-8 font-sans text-sm text-accent-light">message sent. i&apos;ll be in touch.</p>;
  }

  return (
    <form action={action} noValidate className="flex flex-col gap-4">
      {/* Honeypot: hidden from real users */}
      <input
        name="website"
        type="text"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        className="pointer-events-none absolute h-0 w-0 opacity-0"
      />

      <div>
        <label htmlFor="contact-name" className="mb-1.5 block font-sans text-xs text-text-muted">
          name
        </label>
        <input
          id="contact-name"
          name="name"
          type="text"
          required
          maxLength={100}
          autoComplete="name"
          className={FIELD}
          placeholder="your name"
        />
      </div>

      <div>
        <label htmlFor="contact-email" className="mb-1.5 block font-sans text-xs text-text-muted">
          email
        </label>
        <input
          id="contact-email"
          name="email"
          type="email"
          required
          maxLength={200}
          autoComplete="email"
          className={FIELD}
          placeholder="you@example.com"
        />
      </div>

      <div>
        <label htmlFor="contact-message" className="mb-1.5 block font-sans text-xs text-text-muted">
          message
        </label>
        <textarea
          id="contact-message"
          name="message"
          required
          minLength={10}
          maxLength={2000}
          rows={5}
          className={`${FIELD} resize-none`}
          placeholder="what&apos;s on your mind?"
        />
      </div>

      {state.error && (
        <p role="alert" className="text-xs text-red-400">
          {state.error}
        </p>
      )}

      <Cta variant="beam" type="submit" label={pending ? "sending..." : "send"} disabled={pending} room="lobby" className="self-start" />
    </form>
  );
}

function DirectActions() {
  return (
    <div className="flex flex-col items-start gap-5">
      <Cta variant="slide" href="mailto:hayzayd33@gmail.com" label="hayzayd33@gmail.com" room="lobby" />
      <Cta variant="beam" href={CV_HREF} download label="download CV" room="lobby" />
      <Cta variant="slide" href="/work" label="view my work" size="sm" room="lobby" />
    </div>
  );
}

export function CTA({ mode = "resting" }: { mode?: "sequence" | "resting" }) {
  const isSequence = mode === "sequence";

  return (
    <section className={`px-6 ${isSequence ? "flex min-h-screen items-center justify-center" : "py-20"}`}>
      <div className="mx-auto w-full max-w-5xl">
        <SectionHeading>LET&apos;S TALK</SectionHeading>

        <div className="grid gap-16 md:grid-cols-2">
          <motion.div
            initial={{ opacity: 0, x: isSequence ? -30 : 0, y: isSequence ? 0 : 20 }}
            {...(isSequence
              ? { animate: { opacity: 1, x: 0 } }
              : { whileInView: { opacity: 1, y: 0 }, viewport: { once: true, margin: "-80px" } })}
            transition={{ duration: 0.5, ease: "easeOut" }}
          >
            <DirectActions />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: isSequence ? 30 : 0, y: isSequence ? 0 : 20 }}
            {...(isSequence
              ? { animate: { opacity: 1, x: 0 } }
              : { whileInView: { opacity: 1, y: 0 }, viewport: { once: true, margin: "-80px" } })}
            transition={{ duration: 0.5, delay: 0.1, ease: "easeOut" }}
          >
            <ContactForm />
          </motion.div>
        </div>
      </div>
    </section>
  );
}
