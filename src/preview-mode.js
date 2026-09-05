export const PREVIEW_QUERY_KEY = "toolstead-preview";

export function shouldUsePublicPreview(search = "") {
  const params = new URLSearchParams(search);
  return params.get(PREVIEW_QUERY_KEY) === "1";
}

export const isToolPreviewRequested = shouldUsePublicPreview;

export function shouldUseLocalPreview({ isProduction, hasSupabaseConfig, search = "" }) {
  if (isProduction || hasSupabaseConfig) return false;
  return isToolPreviewRequested(search);
}

export function selectPreviewTools(tools = [], allowedCatalogKeys = []) {
  const toolsByKey = new Map(tools.map((tool) => [tool?.key, tool]));
  return [...new Set(allowedCatalogKeys)].map((key) => toolsByKey.get(key)).filter((tool) => {
    const manifest = tool?.manifest;
    return (
      manifest?.catalogKey === tool.key &&
      manifest?.workspaceId === tool.workspaceId &&
      manifest?.runtime === "client" &&
      manifest?.requiresNetwork === false &&
      manifest?.persistence === "session" &&
      tool?.runnable === true
    );
  });
}
