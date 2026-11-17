import { useEffect, useState } from "react";

import type { Installed } from "./api";
import { installs } from "./api";

export const useInstalled = () => {
  const [found, setFound] = useState<Installed[] | null>(null);
  useEffect(() => {
    let alive = true;
    const read = async () => {
      try {
        const listed = await installs();
        if (alive) {
          setFound(listed);
        }
      } catch {
        if (alive) {
          setFound(null);
        }
      }
    };
    read();
    window.addEventListener("focus", read);
    return () => {
      alive = false;
      window.removeEventListener("focus", read);
    };
  }, []);
  return found;
};
