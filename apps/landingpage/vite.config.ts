import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { createSiteConfig } from "./scripts/site-config.mjs";
import legal from "./content/legal.json" with { type: "json" };

export default defineConfig(({ mode }) => ({
  plugins: [react()],
  define: {
    __SITE_CONFIG__: JSON.stringify(
      createSiteConfig(
        { ...loadEnv(mode, process.cwd(), ""), ...process.env },
        legal,
      ),
    ),
  },
  server: { port: 5180, strictPort: true },
  preview: { port: 4180, strictPort: true },
  build: { target: "es2022" },
}));
