import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath, URL } from "node:url";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  base: "/",
  build: {
    rollupOptions: {
      input: {
        home: fileURLToPath(new URL("./index.html", import.meta.url)),
        archive: fileURLToPath(new URL("./archive/index.html", import.meta.url)),
        shop: fileURLToPath(new URL("./shop/index.html", import.meta.url)),
        resources: fileURLToPath(new URL("./resources/index.html", import.meta.url)),
        upcoming: fileURLToPath(new URL("./upcoming/index.html", import.meta.url)),
        notfound: fileURLToPath(new URL("./404.html", import.meta.url)),
        glossary: fileURLToPath(new URL("./resources/glossary/index.html", import.meta.url)),
      },
    },
  },
});
