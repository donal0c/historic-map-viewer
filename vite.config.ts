import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      // Vercel functions are not served by Vite; borrow the deployed ones in dev.
      "/api": {
        target: "https://historicmapviewer.vercel.app",
        changeOrigin: true,
      },
    },
  },
});
