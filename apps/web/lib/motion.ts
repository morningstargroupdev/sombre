import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText } from "gsap/SplitText";

export const ease = {
  in: "power3.in",
  out: "expo.out",
  soft: "power3.out",
} as const;

export const still = () =>
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

let booted = false;

export const boot = () => {
  if (booted) {
    return;
  }
  booted = true;
  gsap.registerPlugin(ScrollTrigger, SplitText);
};

export const scroll = (target: number | string, instant = false) => {
  const behavior = instant || still() ? "instant" : "smooth";
  if (typeof target === "number") {
    window.scrollTo({ behavior, top: target });
    return;
  }
  document.querySelector(target)?.scrollIntoView({ behavior });
};

const split = (node: HTMLElement) => {
  SplitText.create(node, {
    autoSplit: true,
    mask: "lines",
    onSplit: (self) =>
      gsap.from(self.lines, {
        duration: 1.1,
        ease: ease.out,
        scrollTrigger: { once: true, start: "top 90%", trigger: node },
        stagger: 0.08,
        yPercent: 110,
      }),
    type: "lines",
  });
};

export const reveal = () => {
  boot();
  const context = still()
    ? null
    : gsap.context(() => {
        for (const node of document.querySelectorAll<HTMLElement>(
          "[data-split]"
        )) {
          split(node);
        }
        for (const node of document.querySelectorAll<HTMLElement>(
          "[data-rule]"
        )) {
          gsap.from(node, {
            duration: 1.4,
            ease: ease.out,
            scaleX: 0,
            scrollTrigger: { once: true, start: "top 94%", trigger: node },
            transformOrigin: "left center",
          });
        }
        for (const node of document.querySelectorAll<HTMLElement>(
          "[data-rise]"
        )) {
          gsap.from(node, {
            autoAlpha: 0,
            duration: 1,
            ease: ease.out,
            scrollTrigger: { once: true, start: "top 92%", trigger: node },
            y: 28,
          });
        }
      });
  return () => context?.revert();
};

const stage = () => document.querySelector<HTMLElement>("#stage");

export const leave = async () => {
  const node = stage();
  if (!node) {
    return;
  }
  await gsap.to(node, {
    autoAlpha: 0,
    duration: still() ? 0.12 : 0.32,
    ease: ease.in,
    overwrite: true,
    x: still() ? 0 : -36,
  });
};

export const enter = () => {
  const node = stage();
  if (!node) {
    return;
  }
  gsap.fromTo(
    node,
    { autoAlpha: 0, x: still() ? 0 : 36 },
    {
      autoAlpha: 1,
      clearProps: "all",
      duration: still() ? 0.12 : 0.8,
      ease: ease.out,
      overwrite: true,
      x: 0,
    }
  );
};

type Mode = "idle" | "pop" | "push";

let mode: Mode = "idle";
let rescue = 0;

export const depart = () => {
  if (mode === "push") {
    return false;
  }
  mode = "push";
  window.clearTimeout(rescue);
  return true;
};

export const popped = () => {
  mode = "pop";
};

export const stall = () => {
  rescue = window.setTimeout(() => {
    if (mode === "push") {
      mode = "idle";
      enter();
    }
  }, 4000);
};

export const arrive = () => {
  boot();
  window.clearTimeout(rescue);
  const pushed = mode === "push";
  mode = "idle";
  if (pushed) {
    const { hash } = window.location;
    scroll(hash && document.querySelector(hash) ? hash : 0, true);
    enter();
  }
};
