import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
  },
  resolve: {
    alias: {
      "@a2ui/core": resolve(__dirname, "../../packages/a2ui-core/src/index.ts"),
      "@a2ui/react": resolve(__dirname, "../../packages/a2ui-react/src/index.ts"),
    },
  },
  optimizeDeps: {
    exclude: ["@a2ui/core", "@a2ui/react"],
  },
});
