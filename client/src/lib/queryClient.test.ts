/**
 * Pins what apiRequest resolves to.
 *
 * This is a regression guard, not a unit test for its own sake. Six call sites treated the result
 * as a Response and called .json() on it: logging a mentor session, submitting a sprint review,
 * passing a sprint, failing a sprint, getting a demo upload URL, and rescoring an attempt. In
 * every one the request reached the server and succeeded, then the client threw on the missing
 * method and told the user the operation had failed. A mentor was shown "Failed to log session"
 * for a session that had been created with 201.
 *
 * The contract is one line — it returns the parsed body — and it is the sort of thing that is
 * obvious once written down and invisible otherwise.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { apiRequest } from "./queryClient";

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });

const mockFetch = (impl: () => Promise<Response>) => {
  const spy = vi.fn(impl);
  vi.stubGlobal("fetch", spy);
  return spy;
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("apiRequest", () => {
  it("resolves to the parsed body, not a Response", async () => {
    mockFetch(async () => jsonResponse({ id: "s1", sessionType: "Sprint Review" }));

    const result = await apiRequest("POST", "/api/mentor/sessions", { teamId: "t1" });

    expect(result).toEqual({ id: "s1", sessionType: "Sprint Review" });
    // The specific mistake: there is no .json() to call on what comes back.
    expect(result).not.toBeInstanceOf(Response);
    expect((result as any).json).toBeUndefined();
  });

  it("sends the body as JSON for POST", async () => {
    const spy = mockFetch(async () => jsonResponse({ ok: true }));

    await apiRequest("POST", "/api/mentor/sessions", { sessionType: "Sprint Review" });

    const [, init] = spy.mock.calls[0];
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body as string)).toEqual({ sessionType: "Sprint Review" });
  });

  it("works with no body at all, as the pass/fail sprint calls do", async () => {
    mockFetch(async () => jsonResponse({ passed: true }));
    await expect(apiRequest("POST", "/api/sprints/s1/pass")).resolves.toEqual({ passed: true });
  });

  it("throws on a failure response, carrying the server's message", async () => {
    mockFetch(async () => jsonResponse({ message: "A team is required" }, 400));

    await expect(apiRequest("POST", "/api/mentor/sessions", {})).rejects.toThrow(
      "A team is required"
    );
  });

  it("carries the status and body on the error, which callers branch on", async () => {
    // A shared task still waiting on other assignees answers 409 with informational: true, and
    // the caller has to tell that apart from a real failure.
    mockFetch(async () => jsonResponse({ message: "2 still to go", informational: true }, 409));

    const error = await apiRequest("POST", "/api/x", {}).catch((e) => e);
    expect(error.status).toBe(409);
    expect(error.body).toMatchObject({ informational: true });
  });

  it("does not double the /api prefix when the path already has one", async () => {
    const spy = mockFetch(async () => jsonResponse({}));
    await apiRequest("GET", "/api/my-meetings");
    expect(spy.mock.calls[0][0]).toBe("/api/my-meetings");
  });

  it("sends credentials, since every route reads the session cookie", async () => {
    const spy = mockFetch(async () => jsonResponse({}));
    await apiRequest("GET", "/api/my-meetings");
    expect(spy.mock.calls[0][1].credentials).toBe("include");
  });
});
