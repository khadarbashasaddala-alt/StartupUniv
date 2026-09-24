import { useState } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { SiteLayout } from "@/components/layout/site-layout";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ArrowRight,
  Building2,
  GraduationCap,
  Heart,
  Leaf,
  Lightbulb,
  Search,
  Store,
  Wheat,
} from "lucide-react";
import type { ProblemStatement } from "@shared/schema";

const trackIcons: Record<string, React.ElementType> = {
  GovTech: Building2,
  EduTech: GraduationCap,
  HealthTech: Heart,
  MSME: Store,
  AgriTech: Wheat,
  Climate: Leaf,
};

const trackColors: Record<string, string> = {
  GovTech: "track-govtech",
  EduTech: "track-edutech",
  HealthTech: "track-healthtech",
  MSME: "track-msme",
  AgriTech: "track-agritech",
  Climate: "track-climate",
};

const allTracks = ["All", "GovTech", "EduTech", "HealthTech", "MSME", "AgriTech", "Climate"];

export default function ProblemsPage() {
  const [selectedTrack, setSelectedTrack] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");

  const { data: problems, isLoading } = useQuery<ProblemStatement[]>({
    queryKey: ["/api/problems"],
  });

  const filteredProblems = problems?.filter((problem) => {
    const matchesTrack =
      selectedTrack === "All" || problem.track === selectedTrack;
    const matchesSearch =
      !searchQuery ||
      problem.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      problem.overview.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesTrack && matchesSearch;
  });

  return (
    <SiteLayout>
      {/* Hero */}
      <section className="bg-[#12333A] py-16 md:py-20">
        <div className="container relative mx-auto px-4 z-10">
          <div className="max-w-3xl">
            <span className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-3.5 py-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-[#7FD3DD]">
              <Lightbulb className="h-3.5 w-3.5" />
              Open briefs
            </span>
            <h1 className="font-serif text-fluid-h1 font-normal tracking-tight text-white" data-testid="heading-problems">
              Problems someone actually needs solved.
            </h1>
            <p className="mt-5 max-w-2xl text-fluid-body text-white/75">
              Each of these is a real brief from a partner organisation. Teams apply against one, work it
              in tracked sprints, and ship something the organisation can put to use.
            </p>
          </div>
        </div>
      </section>

      {/* Filters */}
      <section className="sticky top-16 z-40 border-b border-[#E3D9CC] bg-[#F6F1E9] py-4">
        <div className="container mx-auto">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex flex-wrap gap-2">
              {allTracks.map((track) => (
                <Button
                  key={track}
                  variant={selectedTrack === track ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedTrack(track)}
                  className={`gap-2 rounded-full ${selectedTrack === track ? "bg-[#17646E] text-white hover:bg-[#124F57]" : "border-2 border-[#E3D9CC] text-[#4A453F] hover:border-[#17646E] hover:bg-transparent hover:text-[#17646E]"}`}
                  data-testid={`filter-${track.toLowerCase()}`}
                >
                  {track !== "All" && trackIcons[track] && (
                    (() => {
                      const Icon = trackIcons[track];
                      return <Icon className="h-3 w-3" />;
                    })()
                  )}
                  {track}
                </Button>
              ))}
            </div>
            <div className="relative w-full md:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search problems..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 bg-white border-2 border-[#E3D9CC] text-gray-900 placeholder:text-gray-400 focus:border-red-600"
                data-testid="input-search"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Problems Grid */}
      <section className="py-12 md:py-16 bg-white">
        <div className="container mx-auto">
          {isLoading ? (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {[...Array(6)].map((_, i) => (
                <Card key={i} className="border-2 border-gray-200">
                  <CardHeader>
                    <Skeleton className="h-6 w-24 mb-2" />
                    <Skeleton className="h-6 w-full" />
                  </CardHeader>
                  <CardContent>
                    <Skeleton className="h-20 w-full" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : filteredProblems && filteredProblems.length > 0 ? (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {filteredProblems.map((problem) => {
                const Icon = trackIcons[problem.track] || Lightbulb;
                return (
                  <Card key={problem.id} className="hover-elevate group border-2 border-gray-200 bg-white shadow-md hover:shadow-lg" data-testid={`card-problem-${problem.id}`}>
                    <CardHeader>
                      <div className="flex items-center justify-between mb-2">
                        <Badge
                          variant="secondary"
                          className={`${trackColors[problem.track]} bg-red-50 text-red-700 border-red-200`}
                        >
                          <Icon className="h-3 w-3 mr-1" />
                          {problem.track}
                        </Badge>
                      </div>
                      <CardTitle className="text-lg line-clamp-2 text-gray-900">
                        {problem.title}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-gray-700 line-clamp-3 mb-4">
                        {problem.overview}
                      </p>
                      <Link href="/plans">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="w-full gap-2 opacity-0 group-hover:opacity-100 transition-opacity text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          Apply to Solve
                          <ArrowRight className="h-3 w-3" />
                        </Button>
                      </Link>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-12">
              <Lightbulb className="h-12 w-12 mx-auto text-gray-400 mb-4" />
              <h3 className="text-lg font-semibold mb-2 text-gray-900">No problems found</h3>
              <p className="text-gray-600 mb-4">
                Try adjusting your filters or search query.
              </p>
              <Button
                variant="outline"
                className="border-2 border-red-600 text-red-600 hover:bg-red-50"
                onClick={() => {
                  setSelectedTrack("All");
                  setSearchQuery("");
                }}
              >
                Clear Filters
              </Button>
            </div>
          )}
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-[#E3D9CC] bg-[#F6F1E9] py-16">
        <div className="container relative mx-auto px-4 text-center z-10">
          <h2 className="font-serif text-fluid-h2 font-normal tracking-tight text-[#12333A]" data-testid="heading-cta">
            Found one worth building?
          </h2>
          <p className="mx-auto mt-4 mb-8 max-w-2xl text-fluid-body text-[#4A453F]">
            Apply against it, and you will be placed on a team with a mentor and a sprint plan to
            work it properly.
          </p>
          <Link href="/plans">
            <Button size="lg" className="gap-2 rounded-full bg-[#17646E] px-7 py-6 text-base font-medium text-white hover:bg-[#124F57]" data-testid="button-apply-cta">
              Start your application
              <ArrowRight className="w-4 h-4" />
            </Button>
          </Link>
        </div>
      </section>
    </SiteLayout>
  );
}
