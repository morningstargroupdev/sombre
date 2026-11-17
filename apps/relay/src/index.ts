import { hex, room } from "./log";
import type { Env } from "./room";
import { GONE, refused } from "./room";

export { Room } from "./room";

const guarded = (response: Response, url: URL) => {
  if (response.webSocket) {
    return response;
  }
  const socket = `${url.protocol === "https:" ? "wss" : "ws"}://${url.host}`;
  const headers = new Headers(response.headers);
  headers.set("Cache-Control", "no-store");
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("Referrer-Policy", "no-referrer");
  headers.set(
    "Content-Security-Policy",
    `default-src 'self'; script-src 'self'; style-src 'unsafe-inline'; img-src 'self' data:; connect-src 'self' ${socket}; frame-ancestors 'none'`
  );
  return new Response(response.body, { headers, status: response.status });
};

const text = (body: string, status: number) =>
  new Response(body, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
    status,
  });

const page = async (env: Env, url: URL) => {
  const asset = await env.ASSETS.fetch(new URL("/phone.html", url));
  const html = await asset.text();
  return new Response(
    html.replace(
      "<head>",
      '<head>\n    <meta name="relay" content="socket" />'
    ),
    { headers: { "Content-Type": "text/html; charset=utf-8" } }
  );
};

const create = async (request: Request, env: Env) => {
  const { success } = await env.LIMIT.limit({
    key: request.headers.get("CF-Connecting-IP") ?? "",
  });
  if (!success) {
    return text(
      "too many new pairings from this network. try again in a minute",
      429
    );
  }
  const id = hex(12);
  const secret = hex(24);
  await env.ROOMS.get(env.ROOMS.idFromName(id)).init(secret);
  return Response.json({ room: id, secret });
};

const answer = (request: Request, env: Env, url: URL) => {
  if (request.method === "POST" && url.pathname === "/rooms") {
    return create(request, env);
  }
  if (request.method === "GET" && url.pathname === "/app.js") {
    return env.ASSETS.fetch(new URL("/app.js", url));
  }
  const found = room(url.pathname);
  if (!found) {
    return request.headers.get("Upgrade")?.toLowerCase() === "websocket"
      ? refused(4404, GONE)
      : text("not found", 404);
  }
  if (request.method === "GET" && found.action === "") {
    return page(env, url);
  }
  return env.ROOMS.get(env.ROOMS.idFromName(found.id)).fetch(request);
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    return guarded(await answer(request, env, url), url);
  },
} satisfies ExportedHandler<Env>;
