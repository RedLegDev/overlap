import { bindings, defineConfig, defineWorker } from "cf/config";

export default defineConfig({
  // Red Leg Dev, LLC
  accountId: "ab1da25c524f59bc61f776304bd88558",
  worker: defineWorker({
    name: "overlap",
    entrypoint: "vinext/server/fetch-handler",
    compatibilityDate: "2026-10-13",
    compatibilityFlags: ["nodejs_compat"],
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
    },
  }),
});
