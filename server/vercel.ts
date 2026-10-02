import type { IncomingMessage, ServerResponse } from "node:http";
import { handleApi } from "./api.ts";

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  if (req.url) {
    const apiIndex = req.url.indexOf("/api");
    if (apiIndex !== -1) {
      req.url = req.url.slice(apiIndex + 4) || "/";
    }
  }
  return handleApi(req, res);
}
