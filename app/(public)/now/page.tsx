import type { Metadata } from "next";
import { createPublicClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "now — hayzaydee",
  description: "What I'm doing right now.",
};

export default async function NowPage() {
  const supabase = await createPublicClient();
  const { data: items } = await supabase
    .from("currently")
    .select("id, verb, content, link")
    .order("created_at", { ascending: false })
    .limit(100);

  return (
    <section className="max-w-xl mx-auto px-6 py-16">
      <ul className="space-y-3">
        {(items ?? []).map((item) => (
          <li key={item.id} className="text-sm font-sans text-(--lobby-text) leading-relaxed">
            <span className="text-accent-muted italic">{item.verb}</span>{" "}
            {item.link ? (
              <a
                href={item.link}
                target="_blank"
                rel="noopener noreferrer"
                className="underline underline-offset-2 decoration-accent/30 hover:text-accent transition-colors"
              >
                {item.content}
              </a>
            ) : (
              item.content
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
