import { useLayoutEffect, useState } from "react";

export const useWidth = <T extends HTMLElement>() => {
  const [node, setNode] = useState<T | null>(null);
  const [width, setWidth] = useState(Number.POSITIVE_INFINITY);

  useLayoutEffect(() => {
    if (!node) {
      return;
    }
    const observer = new ResizeObserver(([entry]) => {
      if (entry) {
        setWidth(entry.borderBoxSize[0]?.inlineSize ?? entry.contentRect.width);
      }
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [node]);

  return [width, setNode] as const;
};
