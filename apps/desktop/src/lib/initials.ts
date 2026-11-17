export const initials = (name: string) => {
  const words = name.split(/[^\p{L}\p{N}]+/u).filter((word) => word !== "");
  const [first = "", second = ""] = words;
  const letters =
    second === "" ? [...first].slice(0, 2) : [[...first][0], [...second][0]];
  return letters.join("").toUpperCase();
};
