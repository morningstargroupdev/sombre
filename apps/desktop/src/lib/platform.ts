export const mac = navigator.userAgent.includes("Mac");

export const shortcut = (key: string, shift = false) => {
  if (mac) {
    return `⌘${shift ? "⇧" : ""}${key.toUpperCase()}`;
  }
  return `ctrl ${shift ? "shift " : ""}${key}`;
};

export const pressed = (event: KeyboardEvent, key: string, shift = false) =>
  event.key.toLowerCase() === key &&
  (mac ? event.metaKey : event.ctrlKey) &&
  event.shiftKey === shift;
