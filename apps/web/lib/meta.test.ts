import { describe, expect, test } from "bun:test";

import { graph, page, script } from "@/lib/meta";

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

  test("describes the site and the organization", () => {
    const types = graph()["@graph"].map((entry) => entry["@type"]);
    expect(types).toEqual(["WebSite", "Organization"]);
  });

  test("escapes markup inside structured data", () => {
    expect(script({ name: "</script>" })).not.toContain("</script>");
  });
});
