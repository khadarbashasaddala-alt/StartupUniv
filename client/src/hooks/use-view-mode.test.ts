import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useViewMode } from "./use-view-mode";

describe("useViewMode", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("defaults to card view when nothing is stored", () => {
    const { result } = renderHook(() => useViewMode("test-key"));
    expect(result.current[0]).toBe("card");
  });

  it("reads a previously stored choice", () => {
    localStorage.setItem("test-key", "table");
    const { result } = renderHook(() => useViewMode("test-key"));
    expect(result.current[0]).toBe("table");
  });

  it("persists a change so the next mount (a page revisit) sees it", () => {
    const { result, unmount } = renderHook(() => useViewMode("test-key"));
    act(() => result.current[1]("table"));
    expect(result.current[0]).toBe("table");
    unmount();

    const { result: second } = renderHook(() => useViewMode("test-key"));
    expect(second.current[0]).toBe("table");
  });

  it("keeps two pages' preferences independent by storage key", () => {
    // The whole reason the key is a parameter: a preference for Users says nothing about Teams.
    const users = renderHook(() => useViewMode("admin-users-view"));
    act(() => users.result.current[1]("table"));

    const teams = renderHook(() => useViewMode("admin-teams-view"));
    expect(teams.result.current[0]).toBe("card");
  });

  it("falls back to the default rather than trusting a corrupted stored value", () => {
    localStorage.setItem("test-key", "grid-of-cards");
    const { result } = renderHook(() => useViewMode("test-key"));
    expect(result.current[0]).toBe("card");
  });

  it("honors a non-default default", () => {
    const { result } = renderHook(() => useViewMode("test-key", "table"));
    expect(result.current[0]).toBe("table");
  });

  describe("when localStorage throws", () => {
    let original: Storage;

    beforeEach(() => {
      original = window.localStorage;
      Object.defineProperty(window, "localStorage", {
        configurable: true,
        value: {
          getItem: () => {
            throw new Error("storage disabled");
          },
          setItem: () => {
            throw new Error("storage disabled");
          },
        },
      });
    });

    afterEach(() => {
      Object.defineProperty(window, "localStorage", { configurable: true, value: original });
    });

    it("still renders with the default, in a private-browsing style environment", () => {
      const { result } = renderHook(() => useViewMode("test-key"));
      expect(result.current[0]).toBe("card");
    });

    it("still updates in-memory even though nothing can be saved", () => {
      const { result } = renderHook(() => useViewMode("test-key"));
      act(() => result.current[1]("table"));
      expect(result.current[0]).toBe("table");
    });
  });
});
