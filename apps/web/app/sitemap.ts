import type { MetadataRoute } from "next";

import { releases } from "@/lib/changelog";
import { pages, site } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  const updated = releases[0]?.date;
  return [
    { lastModified: updated, url: site.url },
    ...pages.map((entry) => ({
      lastModified: updated,
      url: `${site.url}${entry.href}`,
    })),
  ];
}
