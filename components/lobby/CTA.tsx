"use client";

import { useActionState } from "react";
import { sendContact, type ContactState } from "@/app/actions/contact";
import Link from "next/link";

const INITIAL: ContactState = { success: false };

function ContactForm() {
  const [state, action, pending] = useActionState(sendContact, INITIAL);

  if (state.success) {
    return (
      <p className="text-sm font-sans text-(--color-accent) py-8">
        message sent — i&apos;ll be in touch.
      </p>
    );
  }

  return (
    <form action={action} noValidate className="flex flex-col gap-4">
      {/* Honeypot — hidden from real users, visually hidden */}
      <input
        name="website"
        type="text"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        className="absolute opacity-0 w-0 h-0 pointer-events-none"
      />

      <div>
        <label htmlFor="contact-name" className="block text-xs font-sans text-(--color-text-muted) mb-1.5">
          name
        </label>
        <input
          id="contact-name"
          name="name"
          type="text"
          required
          maxLength={100}
          autoComplete="name"
          className="w-full bg-transparent border border-white/15 rounded-md px-3 py-2 text-sm font-sans text-(--lobby-text) placeholder:text-(--color-text-muted) focus:outline-none focus:border-(--lobby-accent) transition-colors"
          placeholder="your name"
        />
      </div>

      <div>
        <label htmlFor="contact-email" className="block text-xs font-sans text-(--color-text-muted) mb-1.5">
          email
        </label>
        <input
          id="contact-email"
          name="email"
          type="email"
          required
          maxLength={200}
          autoComplete="email"
          className="w-full bg-transparent border border-white/15 rounded-md px-3 py-2 text-sm font-sans text-(--lobby-text) placeholder:text-(--color-text-muted) focus:outline-none focus:border-(--lobby-accent) transition-colors"
          placeholder="you@example.com"
        />
      </div>

      <div>
        <label htmlFor="contact-message" className="block text-xs font-sans text-(--color-text-muted) mb-1.5">
          message
        </label>
        <textarea
          id="contact-message"
          name="message"
          required
          minLength={10}
          maxLength={2000}
          rows={5}
          className="w-full bg-transparent border border-white/15 rounded-md px-3 py-2 text-sm font-sans text-(--lobby-text) placeholder:text-(--color-text-muted) focus:outline-none focus:border-(--lobby-accent) transition-colors resize-none"
          placeholder="what&apos;s on your mind?"
        />
      </div>

      {state.error && (
        <p role="alert" className="text-xs text-red-600">
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="self-start text-sm font-sans px-4 py-2 rounded-md border border-(--color-accent) text-(--color-accent) hover:bg-(--color-accent) hover:text-white transition-colors disabled:opacity-50 cursor-pointer"
      >
        {pending ? "sending..." : "send"}
      </button>
    </form>
  );
}

export function CTA() {
  return (
    <section className="bg-(--lobby-surface-deep) py-20 px-6">
      <div className="max-w-5xl mx-auto grid md:grid-cols-2 gap-16">
        {/* Left column — direct actions */}
        <div>
          <h2 className="text-2xl font-sans text-(--lobby-text) mb-8">let&apos;s talk</h2>
          <div className="flex flex-col gap-5">
            <a
              href="mailto:hayzayd33@gmail.com"
              className="text-base font-sans text-(--lobby-accent) hover:text-(--color-accent-light) transition-colors"
            >
              hayzayd33@gmail.com ↗
            </a>
            <a
              href="/cv.pdf"
              download
              className="self-start text-sm font-sans px-4 py-2 rounded-md border border-white/20 text-(--lobby-text) hover:border-(--lobby-accent) hover:text-(--lobby-accent) transition-colors"
            >
              download CV
            </a>
            <Link
              href="/work"
              className="text-sm font-sans text-(--color-text-muted) hover:text-(--lobby-text) transition-colors"
            >
              view my work →
            </Link>
          </div>
        </div>

        {/* Right column — contact form */}
        <div>
          <ContactForm />
        </div>
      </div>
    </section>
  );
}
