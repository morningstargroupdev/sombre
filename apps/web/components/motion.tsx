"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";

import { arrive, depart, leave, popped, stall } from "@/lib/motion";

const plain = (event: MouseEvent) =>
  event.button === 0 &&
  !event.defaultPrevented &&
  !event.metaKey &&
  !event.ctrlKey &&
  !event.shiftKey &&
  !event.altKey;

const internal = (event: MouseEvent) => {
  const link =
    event.target instanceof Element ? event.target.closest("a") : null;
  if (!link || link.hasAttribute("download")) {
    return null;
  }
  if (link.target && link.target !== "_self") {
    return null;
  }
  const url = new URL(link.href, window.location.href);
  const same =
    url.origin === window.location.origin &&
    url.pathname !== window.location.pathname;
  return same ? `${url.pathname}${url.search}${url.hash}` : null;
};

const Arrival = () => {
  useEffect(() => {
    arrive();
  }, []);
  return null;
};

export const Motion = () => {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const click = async (event: MouseEvent) => {
      const href = plain(event) ? internal(event) : null;
      if (!href) {
        return;
      }
      event.preventDefault();
      if (!depart()) {
        return;
      }
      router.prefetch(href);
      await leave();
      router.push(href, { scroll: false });
      stall();
    };
    document.addEventListener("click", click, true);
    window.addEventListener("popstate", popped);
    return () => {
      document.removeEventListener("click", click, true);
      window.removeEventListener("popstate", popped);
    };
  }, [router]);

  return <Arrival key={pathname} />;
};
