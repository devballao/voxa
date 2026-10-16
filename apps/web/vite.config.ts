import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const API = process.env.VITE_DEV_API_TARGET ?? "http://127.0.0.1:3000";
const GATEWAY = process.env.VITE_DEV_GATEWAY_TARGET ?? "ws://127.0.0.1:4000";
// No GitHub Codespaces o navegador chega por <codespace>-5173.app.github.dev;
// o Vite bloqueia hosts desconhecidos, então liberamos só esse domínio.
const CODESPACES = process.env.GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN;

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
    allowedHosts: CODESPACES ? [`.${CODESPACES}`] : [],
    // Em dev, o navegador fala só com o Vite; ele repassa à API e ao gateway.
    // Assim não há CORS, e as URLs do app são relativas (/api, /gateway).
    proxy: {
      "/api": { target: API, changeOrigin: true },
      "/gateway": { target: GATEWAY, ws: true, changeOrigin: true },
    },
  },
  build: {
    sourcemap: true,
  },
});
