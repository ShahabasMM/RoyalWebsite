import type { NextRequest } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const UPSTREAM_ORIGIN = "https://royalstudents.vercel.app";
const APP_PREFIX = "/student-app/";
const APP_SCOPE = "/student-app";

type RouteContext = { params: Promise<{ path?: string[] }> };

const passthroughWorker = `
self.addEventListener('install', (event) => event.waitUntil(self.skipWaiting()));
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));
// Network-only passthrough keeps the app installable without caching private data.
self.addEventListener('fetch', (event) => {
  if (new URL(event.request.url).origin === self.location.origin) {
    event.respondWith(fetch(event.request));
  }
});
`;

function responseHeaders(upstream: Response, contentType?: string) {
  const headers = new Headers();
  const type = contentType ?? upstream.headers.get("content-type");
  if (type) headers.set("content-type", type);
  const cache = upstream.headers.get("cache-control");
  if (cache) headers.set("cache-control", cache);
  const modified = upstream.headers.get("last-modified");
  if (modified) headers.set("last-modified", modified);
  headers.set("x-content-type-options", "nosniff");
  return headers;
}

async function proxy(request: NextRequest, context: RouteContext) {
  const { path = [] } = await context.params;
  if (path.some((part) => part === "." || part === ".." || part.includes("/") || part.includes("\\"))) {
    return new Response("Not found", { status: 404 });
  }

  const resourcePath = path.map(encodeURIComponent).join("/");
  if (resourcePath === "flutter_service_worker.js") {
    return new Response(request.method === "HEAD" ? null : passthroughWorker, {
      status: 200,
      headers: {
        "content-type": "application/javascript; charset=utf-8",
        "cache-control": "no-cache, no-store, must-revalidate",
        "service-worker-allowed": APP_SCOPE,
        "x-content-type-options": "nosniff",
      },
    });
  }

  const target = new URL(resourcePath || ".", `${UPSTREAM_ORIGIN}/`);
  target.search = request.nextUrl.search;

  try {
    const upstream = await fetch(target, {
      method: request.method,
      cache: "no-store",
      redirect: "follow",
    });
    const contentType = upstream.headers.get("content-type") ?? "";

    if (contentType.includes("text/html")) {
      const html = await upstream.text();
      const scopedHtml = html.replace(
        /<base\s+href=(['"])[^'"]*\1\s*\/?\s*>/i,
        `<base href="${APP_PREFIX}">`,
      );
      const headers = responseHeaders(upstream, "text/html; charset=utf-8");
      headers.set("cache-control", "no-cache, must-revalidate");
      return new Response(scopedHtml, { status: upstream.status, headers });
    }

    if (contentType.includes("application/json") && resourcePath.endsWith("manifest.json")) {
      const manifest = await upstream.json() as {
        id?: string;
        start_url?: string;
        scope?: string;
        icons?: Array<{ src: string; [key: string]: unknown }>;
      };
      // Next.js canonicalizes /student-app/ to /student-app, so both the
      // installed start URL and the worker scope use that stable path.
      manifest.id = APP_SCOPE;
      manifest.start_url = APP_SCOPE;
      manifest.scope = APP_SCOPE;
      manifest.icons = manifest.icons?.map((icon) => ({
        ...icon,
        src: new URL(icon.src, `${UPSTREAM_ORIGIN}/`).pathname.startsWith("/icons/")
          ? `${APP_PREFIX}${icon.src.replace(/^\.\//, "").replace(/^\//, "")}`
          : icon.src,
      }));
      const headers = responseHeaders(upstream, "application/manifest+json; charset=utf-8");
      return new Response(JSON.stringify(manifest), { status: upstream.status, headers });
    }

    const headers = responseHeaders(upstream);
    return new Response(request.method === "HEAD" ? null : upstream.body, {
      status: upstream.status,
      headers,
    });
  } catch {
    return new Response("Royal Students is temporarily unavailable.", {
      status: 502,
      headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" },
    });
  }
}

export function GET(request: NextRequest, context: RouteContext) {
  return proxy(request, context);
}

export function HEAD(request: NextRequest, context: RouteContext) {
  return proxy(request, context);
}
