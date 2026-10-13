import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { EventView } from "@/components/EventView";
import { getEvent, getResponses, publicEvent } from "@/lib/server";
import { describeDays } from "@/lib/time";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const event = await getEvent(id);
  if (!event) return { title: "Poll not found", robots: { index: false } };
  const description = `${describeDays(event)}. Mark when you're free.`;
  return {
    title: event.title,
    description,
    robots: { index: false, follow: false },
    openGraph: { title: event.title, description, siteName: "Overlap" },
  };
}

export default async function EventPage({ params }: Props) {
  const { id } = await params;
  const event = await getEvent(id);
  if (!event) notFound();
  const responses = await getResponses(id);
  return <EventView initial={{ event: publicEvent(event), responses, v: event.updated_at }} />;
}
