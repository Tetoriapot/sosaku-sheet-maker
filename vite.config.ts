import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, ".", "");
  return {
    base: env.VITE_BASE_PATH || "/",
    plugins: [react()],
    server: {
      port: Number(env.DEV_PORT || 5174),
      strictPort: true,
      proxy: { "/api": `http://127.0.0.1:${env.API_PORT || 8787}` },
    },
  };
});
