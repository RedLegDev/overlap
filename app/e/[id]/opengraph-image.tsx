import { env } from "cloudflare:workers";
import { ImageResponse } from "next/og";
import { getEvent, getResponses } from "@/lib/server";
import { loadOgImageFonts, OG_FONT_SANS, OG_FONT_SERIF } from "@/lib/og-fonts";
import { OG_COLORS, pollHeatmap, pollOgLines } from "@/lib/og-poll";
import { zoneCity } from "@/lib/time";

export const alt = "Overlap poll";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const CACHE = "public, max-age=300";

type Props = { params: Promise<{ id: string }> };

export default async function Image({ params }: Props) {
  const { id } = await params;
  const event = await getEvent(id);
  if (!event) {
    const fallback = await env.ASSETS.fetch(new URL("/og.png", "https://overlap.local"));
    return new Response(fallback.body, {
      headers: { "content-type": "image/png", "cache-control": CACHE },
    });
  }

  const responses = await getResponses(id);
  const meta = pollOgLines(event, responses);
  const heatmap = pollHeatmap(event, responses);
  const zone = zoneCity(event.timezone);
  const title = event.title.length > 72 ? `${event.title.slice(0, 69)}...` : event.title;
  const fonts = await loadOgImageFonts();

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          background: OG_COLORS.paper,
          padding: 56,
          fontFamily: OG_FONT_SANS,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div
            style={{
              display: "flex",
              width: 40,
              height: 40,
              borderRadius: 8,
              background: OG_COLORS.redleg,
            }}
          />
          <span style={{ fontSize: 36, color: OG_COLORS.ink }}>Overlap</span>
        </div>

        <div style={{ display: "flex", flex: 1, marginTop: 40 }}>
          <div style={{ display: "flex", flexDirection: "column", flex: 1, justifyContent: "center" }}>
            <div
              style={{
                display: "flex",
                fontFamily: OG_FONT_SERIF,
                fontSize: 64,
                color: OG_COLORS.ink,
                lineHeight: 1.05,
              }}
            >
              {title}
            </div>
            <div style={{ display: "flex", flexDirection: "column", marginTop: 28, fontSize: 26, color: OG_COLORS.muted }}>
              <span style={{ display: "flex" }}>{meta.days}</span>
              <span style={{ display: "flex" }}>
                {meta.hours} · {zone} time
              </span>
              <span style={{ display: "flex", color: OG_COLORS.ink, marginTop: 10 }}>{meta.count}</span>
              {meta.locked ? (
                <span style={{ display: "flex", color: "#34c786", fontSize: 24, marginTop: 10 }}>{meta.locked}</span>
              ) : null}
            </div>
          </div>

          {heatmap ? (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
                padding: 20,
                background: OG_COLORS.card,
                borderRadius: 16,
                border: `2px solid ${OG_COLORS.line}`,
              }}
            >
              {heatmap.map((row, ri) => (
                <div key={ri} style={{ display: "flex", marginBottom: 3 }}>
                  {row.map((cell, ci) => (
                    <div
                      key={ci}
                      style={{
                        width: 10,
                        height: 10,
                        marginRight: 3,
                        borderRadius: 2,
                        background: cell.background,
                      }}
                    />
                  ))}
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    ),
    {
      ...size,
      fonts,
      headers: { "cache-control": CACHE },
    },
  );
}
