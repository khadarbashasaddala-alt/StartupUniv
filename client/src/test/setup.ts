/**
 * Vitest setup for the jsdom (client) suite, loaded by vite.config.test.ts.
 *
 * The "/vitest" entrypoint is the one to use: it registers the jest-dom matchers AND declares
 * them on vitest's Assertion type. Importing "./matchers" and calling expect.extend by hand — as
 * this file used to — works at runtime but leaves `toBeInTheDocument` untyped, so every use of it
 * fails `npm run lint`. That went unnoticed because no test under client/ existed to trip it.
 */
import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

// jsdom has no ResizeObserver. Radix components that measure themselves for positioning
// (Select's dropdown among them) call it as soon as they open, and throw ReferenceError without
// this — not specific to any one component's tests, so it belongs here rather than repeated in
// every test file that happens to render one of them.
if (typeof globalThis.ResizeObserver === "undefined") {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

afterEach(() => {
  cleanup();
});
