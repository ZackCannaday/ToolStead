export const PREVIEW_QUERY_KEY = "toolstead-preview";

export function shouldUseLocalPreview({ isProduction, hasSupabaseConfig, search = "" }) {
  if (isProduction || hasSupabaseConfig) return false;
  const params = new URLSearchParams(search);
  return params.get(PREVIEW_QUERY_KEY) === "1";
}
