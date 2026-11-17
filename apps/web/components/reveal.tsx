"use client";

import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useEffect } from "react";

import { reveal } from "@/lib/motion";

export const Reveal = () => {
  useEffect(() => {
    let undo: (() => void) | null = null;
    let live = true;
    const ready = async () => {
      await document.fonts.ready;
      if (live) {
        undo = reveal();
        ScrollTrigger.refresh();
      }
    };
    void ready();
    return () => {
      live = false;
      undo?.();
    };
  }, []);
  return null;
};
