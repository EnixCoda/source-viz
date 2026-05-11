/// <reference types="vitest/config" />

import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";
import { demoDataPlugin } from "./scripts/vite-plugin-demo-data";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    demoDataPlugin(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["icon.svg"],
      manifest: {
        name: "Source Viz",
        short_name: "Source Viz",
        description:
          "Visualize JavaScript/TypeScript file dependencies. All processing happens locally in your browser.",
        theme_color: "#2D3748",
        background_color: "#FFFFFF",
        display: "standalone",
        start_url: ".",
        icons: [
          {
            src: "icon.svg",
            sizes: "any",
            type: "image/svg+xml",
            purpose: "any",
          },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,wasm,json,svg,png,woff2}"],
        // Larger limit so the WASM parser binary gets precached
        maximumFileSizeToCacheInBytes: 25 * 1024 * 1024,
        cleanupOutdatedCaches: true,
      },
    }),
  ],
  worker: {
    format: "es",
  },
  test: {
    environment: "happy-dom",
    exclude: ["**/node_modules/**", "**/dist/**", "**/dist-cli/**"],
  },
});

