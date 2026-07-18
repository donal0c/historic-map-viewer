const FALLBACK_ORIGIN = "https://historicmapviewer.vercel.app";

export async function GET(request: Request): Promise<Response> {
  const requestUrl = new URL(request.url);
  const origin = requestUrl.origin === "null" ? FALLBACK_ORIGIN : requestUrl.origin;
  const title = textParam(requestUrl, "title", "Historic Map Viewer", 100);
  const description = textParam(
    requestUrl,
    "description",
    "Explore an Irish place across historical maps and public heritage records.",
    220,
  );
  const target = safeTarget(requestUrl.searchParams.get("target"));
  const destination = `${origin}${target}`;
  const imageParams = new URLSearchParams(requestUrl.searchParams);
  imageParams.delete("target");
  const image = `${origin}/api/og?${imageParams.toString().replace(/\+/g, "%20")}`;

  const html = `<!doctype html>
<html lang="en"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(title)} · Historic Map Viewer</title>
<meta name="description" content="${escapeHtml(description)}">
<meta property="og:type" content="website">
<meta property="og:title" content="${escapeHtml(title)}">
<meta property="og:description" content="${escapeHtml(description)}">
<meta property="og:image" content="${escapeHtml(image)}">
<meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${escapeHtml(title)}">
<meta name="twitter:description" content="${escapeHtml(description)}">
<meta name="twitter:image" content="${escapeHtml(image)}">
<meta http-equiv="refresh" content="0;url=${escapeHtml(destination)}">
<style>body{margin:0;display:grid;min-height:100vh;place-items:center;background:#1c211c;color:#f4efe3;font:16px system-ui}a{color:#f4efe3}</style>
</head><body><p>Opening <a href="${escapeHtml(destination)}">${escapeHtml(title)}</a>…</p></body></html>`;

  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; img-src https:; base-uri 'none'; frame-ancestors 'none'",
    },
  });
}

function textParam(url: URL, key: string, fallback: string, max: number): string {
  return (
    url.searchParams.get(key)?.replace(/\+/g, " ").trim() || fallback
  ).slice(0, max);
}

function safeTarget(value: string | null): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/";
  return value.slice(0, 2_000);
}

function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (character) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        character
      ] ?? character,
  );
}
