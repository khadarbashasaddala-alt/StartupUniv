/**
 * Convex functions are reachable from any browser that knows the deployment
 * URL, so every mutation below is written to be called by our Express server
 * rather than directly by the client. The server proves it is the server by
 * passing CONVEX_SERVICE_SECRET, which only it and the deployment hold.
 *
 * Set it on the deployment with:
 *   npx convex env set CONVEX_SERVICE_SECRET "<same value as the server .env>"
 */
export function assertService(secret: string) {
  const expected = process.env.CONVEX_SERVICE_SECRET;
  if (!expected) {
    throw new Error(
      "CONVEX_SERVICE_SECRET is not set on the Convex deployment. " +
        "Run: npx convex env set CONVEX_SERVICE_SECRET <value>",
    );
  }
  if (secret !== expected) {
    throw new Error("Not authorised");
  }
}
