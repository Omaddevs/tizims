import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { "@": "/src" },
  },
  server: {
    port: 2011,
    strictPort: true,
    host: true,
    proxy: {
      "/api": { target: "http://localhost:2012", changeOrigin: false },
    },
  },
  preview: {
    port: 2011,
    strictPort: true,
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "server/**/*.test.ts"],
  },
});
