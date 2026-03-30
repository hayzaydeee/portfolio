import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getEssayBySlug, getPublishedEssays } from "@/lib/data/studio";
import { EssayView } from "@/components/studio/EssayView";

export async function generateStaticParams() {
  const essays = await getPublishedEssays();
  return essays.map((e) => ({ slug: e.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const essay = await getEssayBySlug(slug);
  if (!essay) return { title: "essay — hayzaydee" };
  return {
    title: `${essay.title} — hayzaydee`,
    description: essay.subject,
  };
}

export default async function EssayPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const essay = await getEssayBySlug(slug);
  if (!essay) notFound();
  return <EssayView essay={essay} />;
}
