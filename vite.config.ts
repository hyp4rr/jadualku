import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { jadualkuApiPlugin } from "./server/api.ts";

export default defineConfig({
  plugins: [react(), tailwindcss(), jadualkuApiPlugin()],
  // Pre-bundle pdfjs so the lazy SOW import doesn't trigger a dev-mode reload.
  optimizeDeps: { include: ["pdfjs-dist"] },
});
