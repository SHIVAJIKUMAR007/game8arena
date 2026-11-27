import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";
import { robotsTxt, sitemapXml } from "./scripts/seo-files.mjs";
import vibefix from "vibefix/vite";

// In `npm run dev`, serve /sitemap.xml and /robots.txt live from the route list in src/entry-server.jsx.
// (`npm run build` writes the same files into dist/ via scripts/prerender.mjs.)
function seoFilesDev() {
  return {
    name: "seo-files-dev",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const path = req.url?.split("?")[0];
        if (path !== "/sitemap.xml" && path !== "/robots.txt") return next();
        try {
          const { routes, SITE_URL } = await server.ssrLoadModule("/src/entry-server.jsx");
          const xml = path === "/sitemap.xml";
          res.setHeader("Content-Type", xml ? "application/xml; charset=utf-8" : "text/plain; charset=utf-8");
          res.end(xml ? sitemapXml(routes(), SITE_URL) : robotsTxt(SITE_URL));
        } catch (e) {
          next(e);
        }
      });
    },
  };
}

// Ads stay disabled until a certified CMP is configured and VITE_ADSENSE_CMP_CONFIGURED is explicitly true.
function adsense(raw, cmpConfigured) {
  const valid = cmpConfigured === "true" && /^(ca-)?pub-\d+$/.test(raw || "");
  const client = valid ? raw.replace(/^(ca-)?/, "ca-") : "";
  return {
    name: "adsense",
    transformIndexHtml: () =>
      valid
        ? [
            {
              tag: "script",
              injectTo: "head",
              attrs: { async: true, crossorigin: "anonymous", src: `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${client}` },
            },
          ]
        : [],
    generateBundle() {
      if (valid) this.emitFile({ type: "asset", fileName: "ads.txt", source: `google.com, ${client.replace("ca-", "")}, DIRECT, f08c47fec0942fa0\n` });
    },
  };
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "VITE_");
  return {
    plugins: [react(), seoFilesDev(), vibefix(), adsense(env.VITE_ADSENSE_CLIENT, env.VITE_ADSENSE_CMP_CONFIGURED)],
  };
});
