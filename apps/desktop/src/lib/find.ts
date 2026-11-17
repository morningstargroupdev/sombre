export const ranges = (root: Node, query: string): Range[] => {
  const wanted = query.toLowerCase();
  if (wanted === "") {
    return [];
  }
  const found: Range[] = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const text = node.textContent?.toLowerCase() ?? "";
    let at = text.indexOf(wanted);
    while (at !== -1) {
      const range = new Range();
      range.setStart(node, at);
      range.setEnd(node, at + wanted.length);
      found.push(range);
      at = text.indexOf(wanted, at + wanted.length);
    }
  }
  return found;
};

export const paint = (found: Range[], current: number) => {
  CSS.highlights.set("find", new Highlight(...found));
  const range = found[current];
  if (range) {
    CSS.highlights.set("found", new Highlight(range));
  } else {
    CSS.highlights.delete("found");
  }
};

export const clear = () => {
  CSS.highlights.delete("find");
  CSS.highlights.delete("found");
};
