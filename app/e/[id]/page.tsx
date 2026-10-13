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
  if (!event) {
    return {
      title: "Poll not found",
      robots: { index: false },
      openGraph: { images: ["/og.png"] },
      twitter: { card: "summary_large_image", images: ["/og.png"] },
    };
  }
  const description = `${describeDays(event)}. Mark when you're free.`;
  const image = `/e/${id}/opengraph-image`;
  return {
    title: event.title,
    description,
    robots: { index: false, follow: false },
    openGraph: {
      title: event.title,
      description,
      siteName: "Overlap",
      images: [{ url: image, width: 1200, height: 630, alt: event.title }],
    },
    twitter: { card: "summary_large_image", images: [image] },
  };
}

export default async function EventPage({ params }: Props) {
  const { id } = await params;
  const event = await getEvent(id);
  if (!event) notFound();
  const responses = await getResponses(id);
  return <EventView initial={{ event: publicEvent(event), responses, v: event.updated_at }} />;
}
