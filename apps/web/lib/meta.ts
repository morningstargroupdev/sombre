import type { Metadata } from "next";

import { site } from "@/lib/site";

const image = { alt: site.name, height: 630, url: "/og.png", width: 1200 };

export const page = (
  path: string,
  heading: string,
  description: string
): Metadata => {
  const title = heading.toLowerCase();
  return {
    alternates: { canonical: path },
    description,
    openGraph: {
      description,
      images: [image],
      locale: "en_US",
      siteName: site.name,
      title,
      type: "website",
      url: path,
    },
    title,
    twitter: {
      card: "summary_large_image",
      description,
      images: [image.url],
      title,
    },
  };
};

export const graph = () => ({
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebSite",
      name: site.name,
      url: `${site.url}/`,
    },
    {
      "@type": "Organization",
      logo: `${site.url}/icon.svg`,
      name: site.name,
      sameAs: [site.repo],
      url: `${site.url}/`,
    },
  ],
});

export const script = (data: object) =>
  JSON.stringify(data).replaceAll("<", "\\u003c");
