#!/usr/bin/env node
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

// # Validate public config
export function verifyAuthConfig({ javascript, supabaseUrl, publishableKey }) {
  if (!supabaseUrl || !publishableKey) {
    throw new Error("Sites authentication build requires the Supabase URL and publishable key.");
  }
  if (!/^https:\/\/[^/]+\.supabase\.co$/.test(supabaseUrl)) {
    throw new Error("Sites authentication build received an invalid Supabase URL.");
  }
  if (!publishableKey.startsWith("sb_publishable_")) {
    throw new Error("Sites authentication build requires a browser-safe publishable key.");
  }

  if (!javascript.includes(supabaseUrl) || !javascript.includes(publishableKey)) {
    throw new Error("Built client does not contain the required Supabase browser configuration.");
  }
}

// # Inspect emitted client
export function verifyAuthBuild({ distDir, supabaseUrl, publishableKey }) {
  const assetsDir = path.join(distDir, "assets");
  const javascript = readdirSync(assetsDir)
    .filter((name) => name.endsWith(".js"))
    .map((name) => readFileSync(path.join(assetsDir, name), "utf8"))
    .join("\n");
  verifyAuthConfig({ javascript, supabaseUrl, publishableKey });
}

// # Verify deployment build
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  verifyAuthBuild({
    distDir: path.resolve("dist/client"),
    supabaseUrl: process.env.VITE_SUPABASE_URL,
    publishableKey: process.env.VITE_SUPABASE_PUBLISHABLE_KEY,
  });
  console.log("Verified Sites authentication configuration in the built client.");
}
