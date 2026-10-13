import { bindings, defineConfig, defineWorker } from "cf/config";

export default defineConfig({
  // Red Leg Dev, LLC
  accountId: "ab1da25c524f59bc61f776304bd88558",
  worker: defineWorker({
    name: "overlap",
    entrypoint: "vinext/server/fetch-handler",
    compatibilityDate: "2026-10-13",
    compatibilityFlags: ["nodejs_compat"],
    domains: ["overlap.redleg.dev"],
    workersDev: true,
    previewUrls: true,
    assets: { notFoundHandling: "none" },
    observability: { enabled: true },
    env: {
      ASSETS: bindings.assets(),
      DB: bindings.d1({
        name: "overlap",
        id: "613b17af-691d-4e04-87ed-70bd925e74c6",
      }),
      // Per-IP limits. Creating polls is the abuse vector; writes cover joins and saves.
      CREATE_LIMIT: bindings.rateLimit({ namespace: "1001", simple: { limit: 6, period: 60 } }),
      WRITE_LIMIT: bindings.rateLimit({ namespace: "1002", simple: { limit: 120, period: 60 } }),
      TURNSTILE_SITE_KEY: bindings.text("0x4AAAAAAFVtlo88YJl4vigu"),
      TURNSTILE_SECRET: bindings.secret(),
    },
  }),
});
