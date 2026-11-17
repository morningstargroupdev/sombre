import { getCurrentWebview } from "@tauri-apps/api/webview";
import { useEffect } from "react";

import { mac } from "./platform";
import { STEP, scale } from "./scale";

const SAVED = "sombre.zoom";

const saved = () => scale(Number(localStorage.getItem(SAVED) ?? "1") || 1);

const apply = (level: number) => {
  const next = scale(level);
  localStorage.setItem(SAVED, String(next));
  getCurrentWebview()
    .setZoom(next)
    .catch(() => null);
};

export const useZoom = () => {
  useEffect(() => {
    apply(saved());
    const keys = (event: KeyboardEvent) => {
      if (!(mac ? event.metaKey : event.ctrlKey)) {
        return;
      }
      if (event.key === "=" || event.key === "+") {
        event.preventDefault();
        apply(saved() + STEP);
      } else if (event.key === "-") {
        event.preventDefault();
        apply(saved() - STEP);
      } else if (event.key === "0") {
        event.preventDefault();
        apply(1);
      }
    };
    window.addEventListener("keydown", keys);
    return () => window.removeEventListener("keydown", keys);
  }, []);
};
