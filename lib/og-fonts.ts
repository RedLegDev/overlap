import { env } from "cloudflare:workers";

export const OG_FONT_SERIF = "Instrument Serif";
/** Geist is loaded in the app via @fontsource-variable; @vercel/og on Workers only accepts .woff for custom fonts. */
export const OG_FONT_SANS = "sans-serif";

const SERIF_PATH = "/og/instrument-serif-latin-400-normal.woff";

async function loadSerifFont() {
  const res = await env.ASSETS.fetch(new URL(SERIF_PATH, "https://overlap.local"));
  if (!res.ok) throw new Error(`OG font missing: ${SERIF_PATH}`);
  const bytes = new Uint8Array(await res.arrayBuffer());
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
}

export async function loadOgImageFonts() {
  const serif = await loadSerifFont();
  return [{ name: OG_FONT_SERIF, data: serif, weight: 400 as const, style: "normal" as const }];
}
