import { describe, expect, test } from "bun:test";

import { graph, page, script } from "@/lib/meta";
import { site } from "@/lib/site";

describe("meta", () => {
  test("gives every page its own canonical url and share card", () => {
    const docs = page(
      "/docs",
      "Install and use Sombre",
      "How to install Sombre."
    );
    expect(docs.alternates?.canonical).toBe("/docs");
    expect(docs.openGraph?.url).toBe("/docs");
    expect(docs.openGraph?.images).toHaveLength(1);
  });

  test("keeps every title lowercase, like the name", () => {
    const docs = page("/docs", "Install and use Sombre", "How to install it.");
    expect(docs.title).toBe("install and use sombre");
    expect(docs.openGraph?.title).toBe("install and use sombre");
    expect(docs.twitter?.title).toBe("install and use sombre");
    expect(site.title.toLowerCase()).toBe(site.title);
    expect(site.name).toBe("sombre");
  });

  test("describes the site and the organization", () => {
    const types = graph()["@graph"].map((entry) => entry["@type"]);
    expect(types).toEqual(["WebSite", "Organization"]);
  });

  test("escapes markup inside structured data", () => {
    expect(script({ name: "</script>" })).not.toContain("</script>");
  });
});
