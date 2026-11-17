const source = new URL("../../crates/cli/src/", import.meta.url);
const target = new URL("public/", import.meta.url);

await Bun.write(
  new URL("phone.html", target),
  Bun.file(new URL("phone.html", source))
);
await Bun.write(
  new URL("app.js", target),
  Bun.file(new URL("phone.js", source))
);
