/**
 * The submitter filter on the Evidence Locker page.
 *
 * AppLayout is mocked to a plain passthrough: it renders the whole sidebar, header, and tour
 * system, none of which this test is about.
 *
 * The narrowing itself — pick a name, only their evidence remains — is proven exhaustively in
 * shared/evidenceLocker.test.ts, not here. Radix's Select does not open under jsdom (confirmed by
 * hand: userEvent.click on the trigger leaves data-state="closed" and renders no portal content
 * at all, the same limitation already hit in create-meeting-dialog.test.tsx), so a real "click the
 * dropdown, pick a name" interaction cannot be driven from a browser-less test. What this file
 * covers instead is everything around that: the dropdown appears only when there is someone to
 * filter by, it is built from evidence rather than the roster, it survives across roles, and it
 * composes with the type tabs — which, unlike Select, are plain buttons and do click correctly.
 */
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const apiRequest = vi.fn();
const toast = vi.fn();
let currentUser: { id: string; role: string } = { id: "u1", role: "LEARNER" };

vi.mock("@/lib/queryClient", () => ({
  apiRequest: (...args: unknown[]) => apiRequest(...args),
  queryClient: { invalidateQueries: vi.fn() },
}));
vi.mock("@/lib/auth-context", () => ({ useAuth: () => ({ user: currentUser }) }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast }) }));
vi.mock("@/components/layout/app-layout", () => ({
  AppLayout: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock("@/components/ObjectUploader", () => ({ ObjectUploader: () => null }));

import EvidencePage from "./evidence";

const TEAM = {
  id: "t1",
  name: "Capstone Team A",
  track: "AI",
  healthStatus: "Green",
  userRole: "Member",
  userBand: null,
  members: [
    { id: "u1", name: "Aravind P", role: "LEARNER", band: null },
    { id: "u2", name: "Drishti Agrawal", role: "LEARNER", band: null },
  ],
};

const EVIDENCE = [
  { id: "e1", type: "PR", title: "Fix login bug", url: "https://x/1", metaJson: null, createdAt: "2026-08-01", submittedBy: "u1", submitterName: "Aravind P" },
  { id: "e2", type: "Doc", title: "Design notes", url: "https://x/2", metaJson: null, createdAt: "2026-08-02", submittedBy: "u2", submitterName: "Drishti Agrawal" },
  { id: "e3", type: "CI", title: "Build passing", url: "https://x/3", metaJson: null, createdAt: "2026-08-03", submittedBy: "u1", submitterName: "Aravind P" },
];

const open = (evidence: unknown[] = EVIDENCE, team = TEAM) => {
  apiRequest.mockImplementation(async (method: string, path: string) => {
    if (path.includes("/evidence")) return evidence;
    return {};
  });
  const client = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        // /api/my-team has no explicit queryFn in evidence.tsx — it relies on the app's global
        // default, which this test does not import. Standing in for it here.
        queryFn: async () => team,
      },
    },
  });
  return render(
    <QueryClientProvider client={client}>
      <EvidencePage />
    </QueryClientProvider>
  );
};

beforeEach(() => {
  apiRequest.mockReset();
  toast.mockReset();
  currentUser = { id: "u1", role: "LEARNER" };
});

describe("the submitter dropdown", () => {
  it("appears once there is somebody to filter by, defaulted to All members", async () => {
    open();
    await screen.findByText("Fix login bug");
    const trigger = screen.getByTestId("select-submitter");
    expect(trigger).toHaveTextContent("All members");
  });

  it("is absent when nobody has submitted anything yet", async () => {
    open([]);
    await screen.findByText("No evidence found");
    expect(screen.queryByTestId("select-submitter")).not.toBeInTheDocument();
  });

  it("shows the full team's evidence by default, unfiltered", async () => {
    open();
    expect(await screen.findByText("Fix login bug")).toBeInTheDocument();
    expect(await screen.findByText("Design notes")).toBeInTheDocument();
    expect(await screen.findByText("Build passing")).toBeInTheDocument();
  });

  it("gives a mentor the team-selector step, same as any admin/mentor route in this codebase", async () => {
    // Completing the selection would need to open the team Select, which hits the identical
    // jsdom limitation as the submitter Select above — pre-existing to this change, not
    // introduced by it. What is provable without opening it: a mentor reaches the selector
    // rather than being blocked, which is the access-control point actually relevant here — the
    // filter itself is proven role-agnostic by construction (it reads only from the evidence
    // array, never from user.role).
    currentUser = { id: "m1", role: "MENTOR" };
    apiRequest.mockImplementation(async (method: string, path: string) => {
      if (path === "/api/mentor/teams") return [{ id: "t1", name: "Capstone Team A" }];
      if (path.includes("/evidence")) return EVIDENCE;
      return {};
    });
    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <EvidencePage />
      </QueryClientProvider>
    );

    expect(await screen.findByText(/choose from your assigned teams/i)).toBeInTheDocument();
  });
});

describe("combining with the type tabs", () => {
  it("keeps working when a type tab is chosen — the two filters are independent", async () => {
    open();
    await screen.findByText("Fix login bug");

    await userEvent.click(screen.getByTestId("tab-pr"));

    // Only the PR item remains; the person filter is untouched at "All members" throughout.
    expect(screen.getByText("Fix login bug")).toBeInTheDocument();
    expect(screen.queryByText("Design notes")).not.toBeInTheDocument();
    expect(screen.queryByText("Build passing")).not.toBeInTheDocument();
    expect(screen.getByTestId("select-submitter")).toHaveTextContent("All members");
  });

  it("says there is nothing of that type, when that is the actual reason", async () => {
    open();
    await screen.findByText("Fix login bug");
    await userEvent.click(screen.getByTestId("tab-demo"));
    expect(await screen.findByText("No Demo evidence recorded yet")).toBeInTheDocument();
  });
});
