import react from "@vitejs/plugin-react";
import Buffer from "buffer";
import { defineConfig } from "vite";

// https://vitejs.dev/config/
export default defineConfig({
  define: {
    "process.env": process.env,
    Buffer,
  },
  plugins: [react()],
});
