// Production server: `node server/serve.ts` (Node 24 strips types natively).
// Serves dist/ with SPA fallback and mounts the same /api handler as the dev server.

import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { extname, join, normalize } from "node:path";
import { handleApi } from "./api.ts";

const DIST = fileURLToPath(new URL("../dist/", import.meta.url));
const PORT = Number(process.env.PORT ?? 5181);

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".txt": "text/plain; charset=utf-8",
  ".map": "application/json",
};

async function serveStatic(pathname: string): Promise<{ body: Buffer; type: string } | null> {
  const clean = normalize(pathname).replace(/^([/\\])+/, "");
  const file = join(DIST, clean);
  if (!file.startsWith(DIST)) return null;
  try {
    const body = await readFile(file);
    return { body, type: MIME[extname(file).toLowerCase()] ?? "application/octet-stream" };
  } catch {
    return null;
  }
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", "http://local");

  if (url.pathname === "/api" || url.pathname.startsWith("/api/")) {
    // Strip the /api prefix so handleApi sees the same paths as in the Vite middleware.
    req.url = req.url?.slice(req.url.indexOf("/api") + 4) || "/";
    return handleApi(req, res);
  }

  const hit = await serveStatic(url.pathname);
  if (hit) {
    res.statusCode = 200;
    res.setHeader("content-type", hit.type);
    res.end(hit.body);
    return;
  }

  // SPA fallback.
  const index = await serveStatic("index.html");
  if (index) {
    res.statusCode = 200;
    res.setHeader("content-type", index.type);
    res.end(index.body);
    return;
  }

  res.statusCode = 404;
  res.setHeader("content-type", "text/plain; charset=utf-8");
  res.end("Not found — run `npm run build` first.");
});

server.listen(PORT, () => {
  console.log(`JadualKu listening on http://localhost:${PORT}`);
});
