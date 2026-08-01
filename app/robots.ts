import type { MetadataRoute } from "next";
import { absoluteUrl } from "../lib/community";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{
      userAgent: "*",
      allow: ["/", "/blog", "/blog/"],
      disallow: ["/admin/", "/api/", "/biblioteca", "/dashboard", "/login"],
    }],
    sitemap: absoluteUrl("/sitemap.xml"),
  };
}
