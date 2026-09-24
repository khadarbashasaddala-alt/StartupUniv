/**
 * The Team Membership section on the admin user detail page.
 *
 * This wires up GET /admin/users/:userId/teams, which already existed and already worked (the
 * founder problem-statement picker has called it all along) — this page just never called it.
 * So what matters here is the wiring and the three states, not the endpoint's own correctness.
 */
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const apiRequest = vi.fn();
const toast = vi.fn();
const setLocation = vi.fn();

vi.mock("@/lib/queryClient", () => ({
  apiRequest: (...args: unknown[]) => apiRequest(...args),
  queryClient: { invalidateQueries: vi.fn() },
}));
vi.mock("@/lib/auth-context", () => ({
  useAuth: () => ({ user: { id: "admin1", role: "ADMIN" }, isLoading: false }),
}));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast }) }));
vi.mock("@/components/layout/app-layout", () => ({
  AppLayout: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock("wouter", () => ({
  useRoute: () => [true, { userId: "u1" }],
  useLocation: () => ["/app/admin/users/u1", setLocation],
}));

import AdminUserDetailPage from "./admin-user-detail";

const USER = {
  id: "u1",
  email: "abraham.varghese@bbafeh.christuniversity.in",
  name: "ABRAHAM VARGHESE",
  role: "LEARNER",
  phone: null,
  customTag: null,
  createdAt: "2026-08-22T00:00:00.000Z",
};

const open = (teams: unknown[]) => {
  apiRequest.mockImplementation(async (method: string, path: string) => {
    if (path.includes("/teams")) return teams;
    if (path.includes("/application")) return { application: null };
    if (path === `/admin/users/u1`) return USER;
    return {};
  });
  const client = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        // These queries have no explicit queryFn in the component — they rely on the app's
        // global default, which resolves the URL from the query key. Standing in for it here.
        queryFn: async ({ queryKey }: { queryKey: readonly unknown[] }) =>
          apiRequest("GET", queryKey[0] as string),
      },
    },
  });
  return render(
    <QueryClientProvider client={client}>
      <AdminUserDetailPage />
    </QueryClientProvider>
  );
};

beforeEach(() => {
  apiRequest.mockReset();
  setLocation.mockReset();
});

describe("Team Membership", () => {
  it("says plainly when the person is not on any team", async () => {
    open([]);
    expect(await screen.findByText("Not currently on any team.")).toBeInTheDocument();
  });

  it("lists a team with the person's role on it and the project", async () => {
    // Team name and project title are deliberately different strings here, so the assertions
    // below prove both are rendered independently rather than one happening to satisfy both.
    open([
      {
        id: "t1",
        name: "Capstone Team 5",
        cohortId: "c1",
        teamRole: "Member",
        problemStatementId: "ps1",
        problemStatementTitle: "Credit Risk Assessment Using Machine Learning Models",
      },
    ]);

    expect(await screen.findByText("Capstone Team 5")).toBeInTheDocument();
    expect(
      screen.getByText("Credit Risk Assessment Using Machine Learning Models")
    ).toBeInTheDocument();
    expect(screen.getByText("Member")).toBeInTheDocument();
  });

  it("lists more than one team, for someone like a mentor on two", async () => {
    open([
      { id: "t1", name: "Team A", cohortId: "c1", teamRole: "Mentor", problemStatementId: null, problemStatementTitle: null },
      { id: "t2", name: "Team B", cohortId: "c1", teamRole: "Mentor", problemStatementId: null, problemStatementTitle: null },
    ]);

    expect(await screen.findByText("Team A")).toBeInTheDocument();
    expect(screen.getByText("Team B")).toBeInTheDocument();
  });

  it("navigates to the team's own page, not a dead link", async () => {
    open([
      { id: "t1", name: "Team A", cohortId: "c1", teamRole: "Member", problemStatementId: null, problemStatementTitle: null },
    ]);

    await userEvent.click(await screen.findByTestId("button-view-user-team-t1"));
    expect(setLocation).toHaveBeenCalledWith("/app/team/t1");
  });

  it("does not claim a project the team does not have", async () => {
    // problemStatementTitle is genuinely null for a team with nothing assigned yet — the row
    // must not render an empty line or the word "null".
    open([
      { id: "t1", name: "Unassigned Team", cohortId: "c1", teamRole: "Member", problemStatementId: null, problemStatementTitle: null },
    ]);

    await screen.findByText("Unassigned Team");
    expect(screen.queryByText("null")).not.toBeInTheDocument();
  });
});
