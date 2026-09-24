import { useMemo } from "react";
import { useLocation, useRoute } from "wouter";
import { useQuery } from "@tanstack/react-query";

import { SiteLayout } from "@/components/layout/site-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/queryClient";

type InviteInfo = {
  teamApplicationId: string;
  teamName: string;
  memberEmail: string;
  memberName?: string;
  memberRole: "FOUNDER" | "COFOUNDER" | "LEARNER";
  cofounderRole?: "CTO" | "CBO";
  internTrack?: "TECHNICAL" | "BUSINESS" | "BOTH";
};

export default function TeamInvitePage() {
  const [, setLocation] = useLocation();
  const [, params] = useRoute("/plans/team-invite/:token");
  const token = params?.token;

  const { data, isLoading, error } = useQuery<InviteInfo>({
    queryKey: ["/api/team-invites", token],
    queryFn: async () => {
      if (!token) throw new Error("Missing invite token");
      return apiRequest("GET", `/team-invites/${encodeURIComponent(token)}`);
    },
    enabled: !!token,
    retry: false,
  });

  const recommendedPath = useMemo(() => {
    if (!data) return null;

    // Reuse existing plan-based flow via /apply?plan=...
    // The invite token will be carried and used server-side on submission.
    if (data.memberRole === "FOUNDER") return `/apply?plan=founder&invite=${encodeURIComponent(token || "")}`;
    if (data.memberRole === "COFOUNDER") return `/apply?plan=cofounder&invite=${encodeURIComponent(token || "")}`;
    return `/apply?plan=learner&invite=${encodeURIComponent(token || "")}`;
  }, [data, token]);

  return (
    <SiteLayout>
      <section className="bg-gradient-to-br from-white via-[#FEFBF8] to-[#FAF7F3] pt-28 pb-12 md:pt-32 md:pb-16">
        <div className="container mx-auto flex justify-center">
          <div className="w-full max-w-2xl">
            <Card>
              <CardHeader>
                <CardTitle>Team Invitation</CardTitle>
                <CardDescription>
                  Use this link to complete your individual application.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {isLoading ? (
                  <p className="text-gray-700">Validating invitation...</p>
                ) : error ? (
                  <p className="text-destructive">{(error as any)?.message || "Invalid or expired invitation"}</p>
                ) : data ? (
                  <>
                    <div className="text-gray-800">
                      <div><span className="font-semibold">Team:</span> {data.teamName}</div>
                      <div><span className="font-semibold">Email:</span> {data.memberEmail}</div>
                      <div><span className="font-semibold">Role:</span> {data.memberRole}</div>
                    </div>

                    {recommendedPath ? (
                      <Button asChild className="bg-red-600 hover:bg-red-700 text-white">
                        <a href={recommendedPath}>Continue to Application</a>
                      </Button>
                    ) : (
                      <Button
                        className="bg-red-600 hover:bg-red-700 text-white"
                        disabled
                        onClick={() => setLocation("/apply")}
                      >
                        Continue to Application
                      </Button>
                    )}
                  </>
                ) : (
                  <p className="text-gray-700">No invitation data</p>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </section>
    </SiteLayout>
  );
}
