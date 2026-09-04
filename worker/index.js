// # Runtime client config
async function withRuntimeConfig(response, env, request) {
  if (request.method === "HEAD") return response;
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("text/html")) return response;

  const config = JSON.stringify({
    supabaseUrl: env.VITE_SUPABASE_URL || "",
    supabasePublishableKey: env.VITE_SUPABASE_PUBLISHABLE_KEY || "",
  }).replaceAll("<", "\\u003c");
  const html = (await response.text()).replace(
    "</head>",
    `<script id="toolstead-runtime-config" type="application/json">${config}</script></head>`,
  );
  const headers = new Headers(response.headers);
  headers.delete("content-encoding");
  headers.delete("content-length");
  headers.delete("etag");
  headers.set("cache-control", "no-store");
  return new Response(html, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export default {
  async fetch(request, env) {
    const response = await env.ASSETS.fetch(request);
    const acceptsHtml = request.headers.get("accept")?.includes("text/html");

    if (response.status !== 404 || !acceptsHtml || !["GET", "HEAD"].includes(request.method)) {
      return withRuntimeConfig(response, env, request);
    }

    const indexUrl = new URL(request.url);
    indexUrl.pathname = "/index.html";
    indexUrl.search = "";
    const appShell = await env.ASSETS.fetch(new Request(indexUrl, request));
    return withRuntimeConfig(appShell, env, request);
  },
};
