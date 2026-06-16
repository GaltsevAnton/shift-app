import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  server: {
    proxy: {
      '/api': 'http://192.168.1.19:8080',
      '/photos': 'http://192.168.1.19:8080',
    },
  },
  build: {
    rollupOptions: {
      input: {
        main:  "index.html",
        kiosk: "kiosk.html",
      },
    },
  },
  plugins: [
    react(),

    VitePWA({
      registerType: "autoUpdate",
      workbox: {
        navigateFallbackDenylist: [/^\/photos\//, /^\/api\//],
      },
      manifest: {
        name: "HannoSHIFT",
        short_name: "Hanno\nSHIFT",
        description: "Shift Management System",

        theme_color: "#2F5496",
        background_color: "#ffffff",

        display: "standalone",
        orientation: "portrait",

        icons: [
          {
            src: "/pwa-192.png",
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: "/pwa-512.png",
            sizes: "512x512",
            type: "image/png",
          },
        ],
      },
    }),
  ],
});