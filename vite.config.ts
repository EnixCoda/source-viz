/// <reference types="vitest/config" />

import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { demoDataPlugin } from "./scripts/vite-plugin-demo-data";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), demoDataPlugin()],
  test: {
    environment: "happy-dom",
  },
});
