import { test } from "node:test";
import assert from "node:assert/strict";
import { redlegUrl } from "./site.ts";

test("redlegUrl tags the placement and nothing else", () => {
  const u = new URL(redlegUrl("organizer"));
  assert.equal(u.origin, "https://redleg.dev");
  assert.deepEqual(Object.fromEntries(u.searchParams), {
    utm_source: "overlap",
    utm_medium: "referral",
    utm_content: "organizer",
  });
});
