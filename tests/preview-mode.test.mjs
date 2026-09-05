import test from "node:test";
import assert from "node:assert/strict";

import { shouldUseLocalPreview } from "../src/preview-mode.js";

test("explicit preview is available only without production or Supabase", () => {
  assert.equal(
    shouldUseLocalPreview({
      isProduction: false,
      hasSupabaseConfig: false,
      search: "?toolstead-preview=1",
    }),
    true,
  );
  assert.equal(
    shouldUseLocalPreview({
      isProduction: true,
      hasSupabaseConfig: false,
      search: "?toolstead-preview=1",
    }),
    false,
  );
  assert.equal(
    shouldUseLocalPreview({
      isProduction: false,
      hasSupabaseConfig: true,
      search: "?toolstead-preview=1",
    }),
    false,
  );
});

test("preview mode requires the exact opt-in value", () => {
  for (const search of ["", "?toolstead-preview=0", "?toolstead-preview=true"]) {
    assert.equal(
      shouldUseLocalPreview({
        isProduction: false,
        hasSupabaseConfig: false,
        search,
      }),
      false,
    );
  }
});
