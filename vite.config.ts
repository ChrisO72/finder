import { reactRouter } from "@react-router/dev/vite";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

export default defineConfig({
  publicDir: "web/public",
  plugins: [tailwindcss(), reactRouter()],
  resolve: {
    alias: [
      { find: "~/db", replacement: fileURLToPath(new URL("./db", import.meta.url)) },
      { find: "~/worker", replacement: fileURLToPath(new URL("./worker", import.meta.url)) },
      {
        find: "~/env.server",
        replacement: fileURLToPath(new URL("./env.server.ts", import.meta.url)),
      },
      { find: "~", replacement: fileURLToPath(new URL("./web", import.meta.url)) },
    ],
  },
});
