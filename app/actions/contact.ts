"use server";

import { z } from "zod";
import DOMPurify from "isomorphic-dompurify";

const schema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email().max(200),
  message: z.string().min(10).max(2000),
  // honeypot — must be empty
  website: z.string().max(0, "bot detected"),
});

export type ContactState = {
  success: boolean;
  error?: string;
};

function sanitise(str: string) {
  return DOMPurify.sanitize(str, { ALLOWED_TAGS: [] });
}

export async function sendContact(
  _prev: ContactState,
  formData: FormData
): Promise<ContactState> {
  const raw = {
    name: formData.get("name"),
    email: formData.get("email"),
    message: formData.get("message"),
    website: formData.get("website") ?? "",
  };

  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    const msg = parsed.error.issues[0]?.message ?? "Invalid input";
    // Don't reveal honeypot detection to bots
    if (msg === "bot detected") return { success: false, error: "Something went wrong." };
    return { success: false, error: msg };
  }

  const { name, email, message } = parsed.data;

  // Send email via mailto instruction — in production wire to Resend or similar
  // For now: log to console (Phase 2 will wire transactional email)
  console.log("Contact form submission:", {
    name: sanitise(name),
    email: sanitise(email),
    message: sanitise(message),
  });

  return { success: true };
}
