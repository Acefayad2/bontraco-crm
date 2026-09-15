import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    assetsInlineLimit: 0,
    sourcemap: false,
    target: "es2022",
    rolldownOptions: {
      output: {
        codeSplitting: {
          maxSize: 300000,
          groups: [
            { name: "supabase", test: /node_modules[\\/]@supabase/ },
            { name: "react", test: /node_modules[\\/](react|react-dom|react-router|scheduler)/ },
            { name: "validation", test: /node_modules[\\/]zod/ },
          ],
        },
      },
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    pool: "vmThreads",
    setupFiles: ["./src/test/setup.ts"],
  },
});
