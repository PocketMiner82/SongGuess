import { routePartykitRequest } from "partyserver";


export { SongGuessAPI } from "./api/SongGuessAPI";

export { SongGuessServer } from "./SongGuessServer";

export default {
  async fetch(req, env) {
    const url: URL = new URL(req.url);

    // route api endpoint to a shared durable object
    if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/parties/api/")) {
      const stub = env.SongGuessAPI.getByName("default");
      return stub.fetch(req);
    }

    let resp = await routePartykitRequest(req, { ...env });

    // if some url is requested without HTML extension, try adding it
    if (!resp && !url.pathname.endsWith(".html")) {
      try {
        resp = await env.ASSETS.fetch(`${url.pathname}.html${url.search}`);
      } catch { }
    }

    // redirect to main page, if requested site not found
    return resp || Response.redirect(url.origin);
  },
} satisfies ExportedHandler<Env>;
