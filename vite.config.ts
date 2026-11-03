import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath, URL } from "node:url";
import type { Plugin } from "vite";

/* Cloudflare Web Analytics (free, no cookies). Paste the site token from
   dash.cloudflare.com > Web Analytics > amongtheletters.com > Manage site. The token is public by design.
   While it is empty no beacon is added. Every page built by Vite gets the beacon once, so new pages are covered.
   "spa" counts in-place page changes (the router uses history.pushState) as page views. */
const CF_BEACON_TOKEN = "99b2abd3f2384b09b2d2cf5257cb2c4c";

function cfWebAnalytics(): Plugin {
  return {
    name: "atl-cf-web-analytics",
    transformIndexHtml(html) {
      if (!CF_BEACON_TOKEN || html.includes("static.cloudflareinsights.com/beacon.min.js")) return html;
      return [{
        tag: "script",
        attrs: { defer: true, src: "https://static.cloudflareinsights.com/beacon.min.js", "data-cf-beacon": JSON.stringify({ token: CF_BEACON_TOKEN, spa: true }) },
        injectTo: "body",
      }];
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), cfWebAnalytics()],
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
        calendar: fileURLToPath(new URL("./calendar/index.html", import.meta.url)),
        opportunities: fileURLToPath(new URL("./opportunities/index.html", import.meta.url)),
        jadePages: fileURLToPath(new URL("./jade-pages/index.html", import.meta.url)),
        account: fileURLToPath(new URL("./account/index.html", import.meta.url)),
        membership: fileURLToPath(new URL("./membership/index.html", import.meta.url)),
        notfound: fileURLToPath(new URL("./404.html", import.meta.url)),
        glossary: fileURLToPath(new URL("./resources/glossary/index.html", import.meta.url)),
      },
    },
  },
});
