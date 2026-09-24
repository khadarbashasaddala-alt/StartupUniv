import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { api } from "./_generated/api";

const http = httpRouter();

/**
 * Serves public media straight to the browser, so an <img> or <video> tag can
 * point at this deployment without going through Express.
 *
 * It redirects to the underlying storage URL rather than proxying the bytes:
 * that URL honours HTTP range requests, which is what lets a browser seek
 * inside a video instead of downloading the whole thing first.
 *
 *   https://shiny-cheetah-636.eu-west-1.convex.site/media?id=<mediaId>
 *
 * Private media is not reachable here by design -- getPublicUrl returns null
 * for it, and those go through /api/media/:id/content on the Express server,
 * which checks the session.
 */
http.route({
  path: "/media",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const id = new URL(request.url).searchParams.get("id");
    if (!id) {
      return new Response("Missing id", { status: 400 });
    }

    // getPublicUrl normalises the id itself and returns null when it does not
    // name a row, so a malformed id lands on the same 404 as a missing one.
    const media = await ctx.runQuery(api.media.getPublicUrl, { mediaId: id });
    if (!media?.url) {
      return new Response("Not found", { status: 404 });
    }

    return Response.redirect(media.url, 302);
  }),
});

/** Cheap liveness probe for the deployment. */
http.route({
  path: "/health",
  method: "GET",
  handler: httpAction(async () => {
    return new Response(JSON.stringify({ status: "ok" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }),
});

export default http;
