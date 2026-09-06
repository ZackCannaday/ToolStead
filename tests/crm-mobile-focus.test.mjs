import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const APP_SOURCE_URL = new URL("../src/App.jsx", import.meta.url);

// # Mobile keyboard regression
test("lead dialog only moves focus when the modal mounts", async () => {
  const source = await readFile(APP_SOURCE_URL, "utf8");
  const modalStart = source.indexOf("function Modal(");
  const modalEnd = source.indexOf("// # Tool dashboard", modalStart);
  const modalSource = source.slice(modalStart, modalEnd);

  assert.ok(modalStart >= 0 && modalEnd > modalStart, "Modal source must exist");
  assert.match(modalSource, /const onCloseRef = useRef\(onClose\)/);
  assert.match(modalSource, /onCloseRef\.current = onClose/);
  assert.match(modalSource, /onCloseRef\.current\?\.\(\)/);
  assert.match(
    modalSource,
    /closeRef\.current\?\.focus\(\);[\s\S]*?window\.addEventListener\("keydown", escape\);[\s\S]*?\}, \[\]\);/,
  );
  assert.doesNotMatch(
    modalSource,
    /closeRef\.current\?\.focus\(\);[\s\S]*?\}, \[onClose\]\);/,
    "field updates must not refocus the close button and dismiss the mobile keyboard",
  );
});
