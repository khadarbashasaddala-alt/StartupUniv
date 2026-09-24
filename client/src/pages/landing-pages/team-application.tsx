import { useEffect } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Link, useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";

import { SiteLayout } from "@/components/layout/site-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

const memberRoleSchema = z.enum(["FOUNDER", "COFOUNDER", "LEARNER"]);
const cofounderSubRoleSchema = z.enum(["CTO", "CBO"]);
const internTrackSchema = z.enum(["TECHNICAL", "BUSINESS", "BOTH"]);

const teamApplicationFormSchema = z
  .object({
    team_name: z.string().min(1, "Team name is required"),
    project_description: z.string().min(1, "Project description is required"),

    team_leader_full_name: z.string().min(1, "Team leader name is required"),
    team_leader_email: z.string().email("Valid leader email is required"),
    team_leader_phone: z.string().optional(),

    number_of_members: z
      .coerce
      .number()
      .int()
      .min(2, "At least 2 members are required")
      .max(10, "Maximum 10 members allowed"),

    acceptTerms: z.boolean().refine((v) => v === true, { message: "You must accept the Terms and Conditions." }),

    members: z
      .array(
        z.object({
          member_full_name: z.string().min(1, "Member name is required"),
          member_email: z.string().email("Valid member email is required"),
          member_role: memberRoleSchema,
          cofounder_role: cofounderSubRoleSchema.optional(),
          intern_track: internTrackSchema.optional(),
        })
      )
      .min(2)
      .max(10),
  })
  .superRefine((data, ctx) => {
    if (data.members.length !== data.number_of_members) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["members"],
        message: "Members count must match number of members",
      });
    }

    const emails = data.members.map((m) => m.member_email.toLowerCase().trim());
    const uniqueEmails = new Set(emails);
    if (uniqueEmails.size !== emails.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["members"],
        message: "Duplicate member emails are not allowed",
      });
    }

    data.members.forEach((m, idx) => {
      if (m.member_role === "COFOUNDER" && !m.cofounder_role) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["members", idx, "cofounder_role"],
          message: "Select CTO or CBO",
        });
      }
      if (m.member_role === "LEARNER" && !m.intern_track) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["members", idx, "intern_track"],
          message: "Select Technical, Business, or Both",
        });
      }
      if (m.member_role === "FOUNDER") {
        if (m.cofounder_role) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["members", idx, "cofounder_role"],
            message: "Founder cannot have CTO/CBO",
          });
        }
        if (m.intern_track) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["members", idx, "intern_track"],
            message: "Founder cannot have intern track",
          });
        }
      }
    });
  });

type TeamApplicationForm = z.infer<typeof teamApplicationFormSchema>;

function buildMembers(count: number, leaderName: string, leaderEmail: string): TeamApplicationForm["members"] {
  const members: TeamApplicationForm["members"] = [];
  members.push({
    member_full_name: leaderName || "",
    member_email: leaderEmail || "",
    member_role: "FOUNDER",
  });
  for (let i = 1; i < count; i++) {
    members.push({
      member_full_name: "",
      member_email: "",
      member_role: "LEARNER",
      intern_track: "TECHNICAL",
    });
  }
  return members;
}

export default function TeamApplicationPage() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const form = useForm<TeamApplicationForm>({
    resolver: zodResolver(teamApplicationFormSchema),
    defaultValues: {
      team_name: "",
      project_description: "",
      team_leader_full_name: "",
      team_leader_email: "",
      team_leader_phone: "",
      number_of_members: 2,
      members: buildMembers(2, "", ""),
      acceptTerms: false,
    },
    mode: "onBlur",
  });

  const leaderName = form.watch("team_leader_full_name");
  const leaderEmail = form.watch("team_leader_email");
  const memberCount = form.watch("number_of_members");

  // Keep members array sized to number_of_members.
  useEffect(() => {
    const current = form.getValues("members");
    if (!Array.isArray(current)) return;

    if (current.length === memberCount) return;

    const next = buildMembers(memberCount, leaderName, leaderEmail);

    // Preserve existing non-leader entries where possible
    for (let i = 1; i < Math.min(current.length, next.length); i++) {
      next[i] = {
        ...next[i],
        ...current[i],
        member_role: current[i].member_role ?? next[i].member_role,
      } as any;
    }

    // Keep leader row name/email synced, but allow leader role changes
    const existingLeader = current[0] as any;
    const leaderRole = existingLeader?.member_role ?? "FOUNDER";
    const normalizedLeader: any = {
      ...existingLeader,
      member_full_name: leaderName || "",
      member_email: leaderEmail || "",
      member_role: leaderRole,
    };
    if (leaderRole !== "COFOUNDER") normalizedLeader.cofounder_role = undefined;
    if (leaderRole !== "LEARNER") normalizedLeader.intern_track = undefined;
    next[0] = normalizedLeader;

    form.setValue("members", next, { shouldValidate: true });
  }, [memberCount, leaderName, leaderEmail, form]);

  // Sync leader fields into first member row.
  useEffect(() => {
    const current = form.getValues("members");
    if (!current?.length) return;
    const leaderRow = current[0];
    if (!leaderRow) return;

    const updated: any = {
      ...leaderRow,
      member_full_name: leaderName || "",
      member_email: leaderEmail || "",
    };
    if (updated.member_role !== "COFOUNDER") updated.cofounder_role = undefined;
    if (updated.member_role !== "LEARNER") updated.intern_track = undefined;
    form.setValue("members.0", updated, { shouldValidate: true });
  }, [leaderName, leaderEmail, form]);

  const mutation = useMutation({
    mutationFn: async (data: TeamApplicationForm) => {
      return apiRequest("POST", "/team-applications", data);
    },
    onSuccess: () => {
      toast({
        title: "Team application submitted",
        description: "Your team application has been submitted for review.",
      });
      setLocation("/plans");
    },
    onError: (error: any) => {
      toast({
        title: "Submission failed",
        description: error?.message || "Please try again",
        variant: "destructive",
      });
    },
  });

  const members = useWatch({ control: form.control, name: "members" }) || [];

  return (
    <SiteLayout>
      {/* Header */}
      <section className="bg-[#f8f4f1] px-6 py-6">
        <h1 className="text-fluid-h1 font-light uppercase tracking-[-0.2px] text-[#1d1a17]">
          Apply to StartupUniv
        </h1>
      </section>

      {/* Info Cards */}
      <div className="flex flex-col md:flex-row gap-6 px-6 py-6">
        <div className="bg-white flex-1 px-6 py-8">
          <div className="border-b border-[#17646E] pb-3 mb-4 max-w-[420px]">
            <h2 className="text-3xl text-[#17646E] tracking-[-0.6px]">Team Submission Rules</h2>
            <p className="text-[#17646E] text-sm mt-2">Before You Submit:</p>
          </div>
          <ul className="list-disc pl-6 text-[#17646E] text-sm space-y-1">
            <li>Team Size: 2 to 10 members in total</li>
            <li>Unique Emails: Each member must have a unique email address</li>
            <li>Role Selection:
              <ul className="list-disc pl-6 mt-1 space-y-1">
                <li>Co-founder: Must choose either CTO or CBO</li>
                <li>Intern: Must select a track</li>
              </ul>
            </li>
          </ul>
        </div>
        <div className="bg-white flex-1 px-6 py-8">
          <div className="border-b border-[#17646E] pb-3 mb-4 max-w-[420px]">
            <h2 className="text-3xl text-[#17646E] tracking-[-0.6px]">What Happens Next</h2>
            <p className="text-[#17646E] text-sm mt-2">After Submission:</p>
          </div>
          <ul className="list-disc pl-6 text-[#17646E] text-sm space-y-1">
            <li>Application Review: Your team application will be reviewed by the team.</li>
            <li>Acceptance: If accepted, invites and credentials will be shared with all members.</li>
          </ul>
        </div>
      </div>

      {/* Form */}
      <div className="bg-white px-6 py-6 mx-6 mb-12">
        <div className="mb-8">
          <h2 className="text-2xl uppercase tracking-[-0.2px] text-[#1d1a17]">Application Form</h2>
          <p className="text-sm text-[rgba(29,26,23,0.6)] mt-1">Provide team and member details (2 to 10 members total).</p>
        </div>
        <form className="space-y-8" onSubmit={form.handleSubmit((data) => mutation.mutate(data))}>
          {/* Section A */}
          <div className="border-b-2 border-black/20 pb-6 space-y-6">
            <h3 className="text-sm uppercase tracking-[-0.2px] text-[#1d1a17]">Section A: Team Details</h3>
            <div className="space-y-1">
              <Label className="text-[#1d1a17] text-base">Team Name *</Label>
              <Input
                {...form.register("team_name")}
                placeholder="Your team name"
                className="border-0 border-b border-[#dbdee6] rounded-none bg-white focus-visible:ring-0 px-0"
              />
              {form.formState.errors.team_name && (
                <p className="text-sm text-destructive">{form.formState.errors.team_name.message}</p>
              )}
            </div>
            <div className="space-y-1">
              <Label className="text-[#1d1a17] text-base">Project Description *</Label>
              <Textarea
                {...form.register("project_description")}
                placeholder="type here"
                className="border border-[#dbdee6] rounded-none bg-white focus-visible:ring-0 min-h-[106px]"
              />
              <p className="text-xs text-[#747b8b]">Minimum 50 characters</p>
              {form.formState.errors.project_description && (
                <p className="text-sm text-destructive">{form.formState.errors.project_description.message}</p>
              )}
            </div>
          </div>
          {/* Section B */}
          <div className="border-b-2 border-black/20 pb-6 space-y-6">
            <h3 className="text-sm uppercase tracking-[-0.2px] text-[#1d1a17]">Section B: Team Leader Details</h3>
            <div className="grid gap-x-16 gap-y-4 md:grid-cols-2">
              <div className="space-y-1">
                <Label className="text-[#1d1a17] text-base">Full Name *</Label>
                <Input
                  {...form.register("team_leader_full_name")}
                  placeholder="Your name"
                  className="border-0 border-b border-[#dbdee6] rounded-none bg-white focus-visible:ring-0 px-0"
                />
                {form.formState.errors.team_leader_full_name && (
                  <p className="text-sm text-destructive">{form.formState.errors.team_leader_full_name.message}</p>
                )}
              </div>
              <div className="space-y-1">
                <Label className="text-[#1d1a17] text-base">Email *</Label>
                <Input
                  type="email"
                  {...form.register("team_leader_email")}
                  placeholder="your@gmail.com"
                  className="border-0 border-b border-[#dbdee6] rounded-none bg-white focus-visible:ring-0 px-0"
                />
                {form.formState.errors.team_leader_email && (
                  <p className="text-sm text-destructive">{form.formState.errors.team_leader_email.message}</p>
                )}
              </div>
            </div>
          </div>
          {/* Section C */}
          <div className="border-b-2 border-black/20 pb-6 space-y-6">
            <h3 className="text-sm uppercase tracking-[-0.2px] text-[#1d1a17]">Section C: Team Members</h3>
            <div className="space-y-1">
              <Label className="text-[#1d1a17] text-base">Number of Members (2 to 10) *</Label>
              <Input
                type="number"
                min={2}
                max={10}
                {...form.register("number_of_members")}
                placeholder="Number of Members"
                className="border-0 border-b border-[#dbdee6] rounded-none bg-white focus-visible:ring-0 px-0"
              />
              {form.formState.errors.number_of_members && (
                <p className="text-sm text-destructive">{form.formState.errors.number_of_members.message}</p>
              )}
            </div>
          </div>
          {/* Section D */}
          <div className="border-b-2 border-black/20 pb-6 space-y-6">
            <h3 className="text-sm uppercase tracking-[-0.2px] text-[#1d1a17]">Section D: Members</h3>
            {members.map((m, idx) => {
              const rolePath = `members.${idx}.member_role` as const;
              const namePath = `members.${idx}.member_full_name` as const;
              const emailPath = `members.${idx}.member_email` as const;
              const cofounderRolePath = `members.${idx}.cofounder_role` as const;
              const internTrackPath = `members.${idx}.intern_track` as const;
              const roleError = (form.formState.errors.members?.[idx] as any)?.member_role?.message as string | undefined;
              const nameError = (form.formState.errors.members?.[idx] as any)?.member_full_name?.message as string | undefined;
              const emailError = (form.formState.errors.members?.[idx] as any)?.member_email?.message as string | undefined;
              const cofounderRoleError = (form.formState.errors.members?.[idx] as any)?.cofounder_role?.message as string | undefined;
              const internTrackError = (form.formState.errors.members?.[idx] as any)?.intern_track?.message as string | undefined;
              const isLeaderRow = idx === 0;
              return (
                <div key={idx} className="space-y-4">
                  <p className="text-[#1d1a17] text-base font-medium">Member {idx + 1}{isLeaderRow ? " (Team Leader)" : ""}</p>
                  <div className="grid gap-x-16 gap-y-4 md:grid-cols-2">
                    <div className="space-y-1">
                      <Label className="text-[#1d1a17] text-base">Full Name *</Label>
                      <Input
                        {...form.register(namePath)}
                        disabled={isLeaderRow}
                        placeholder="Your name"
                        className="border-0 border-b border-[#dbdee6] rounded-none bg-white focus-visible:ring-0 px-0 disabled:opacity-60"
                      />
                      {nameError && <p className="text-sm text-destructive">{nameError}</p>}
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[#1d1a17] text-base">Email *</Label>
                      <Input
                        type="email"
                        {...form.register(emailPath)}
                        disabled={isLeaderRow}
                        placeholder="your@gmail.com"
                        className="border-0 border-b border-[#dbdee6] rounded-none bg-white focus-visible:ring-0 px-0 disabled:opacity-60"
                      />
                      {emailError && <p className="text-sm text-destructive">{emailError}</p>}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[#1d1a17] text-base">Role *</Label>
                    <Select
                      value={m.member_role}
                      onValueChange={(value) => {
                        form.setValue(rolePath, value as any, { shouldValidate: true });
                        if (value !== "COFOUNDER") form.setValue(cofounderRolePath, undefined, { shouldValidate: true });
                        if (value !== "LEARNER") form.setValue(internTrackPath, undefined, { shouldValidate: true });
                        if (value === "COFOUNDER") form.setValue(cofounderRolePath, "CTO", { shouldValidate: true });
                        if (value === "LEARNER") form.setValue(internTrackPath, "TECHNICAL", { shouldValidate: true });
                      }}
                    >
                      <SelectTrigger className="border-0 border-b border-[#dbdee6] rounded-none bg-white focus:ring-0 focus:outline-none px-0">
                        <SelectValue placeholder="Role" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="FOUNDER">Founder</SelectItem>
                        <SelectItem value="COFOUNDER">Co-Founder</SelectItem>
                        <SelectItem value="LEARNER">Intern</SelectItem>
                      </SelectContent>
                    </Select>
                    {roleError && <p className="text-sm text-destructive">{roleError}</p>}
                  </div>
                  {m.member_role === "COFOUNDER" && (
                    <div className="space-y-1">
                      <Label className="text-[#1d1a17] text-base">Co-Founder Type *</Label>
                      <Select
                        value={m.cofounder_role}
                        onValueChange={(value) => form.setValue(cofounderRolePath, value as any, { shouldValidate: true })}
                      >
                        <SelectTrigger className="border-0 border-b border-[#dbdee6] rounded-none bg-white focus:ring-0 px-0">
                          <SelectValue placeholder="Select" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="CTO">CTO</SelectItem>
                          <SelectItem value="CBO">CBO</SelectItem>
                        </SelectContent>
                      </Select>
                      {cofounderRoleError && <p className="text-sm text-destructive">{cofounderRoleError}</p>}
                    </div>
                  )}
                  {m.member_role === "LEARNER" && (
                    <div className="space-y-1">
                      <Label className="text-[#1d1a17] text-base">Intern Track *</Label>
                      <Select
                        value={m.intern_track}
                        onValueChange={(value) => form.setValue(internTrackPath, value as any, { shouldValidate: true })}
                      >
                        <SelectTrigger className="border-0 border-b border-[#dbdee6] rounded-none bg-white focus:ring-0 px-0">
                          <SelectValue placeholder="Technical" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="TECHNICAL">Technical</SelectItem>
                          <SelectItem value="BUSINESS">Business</SelectItem>
                          <SelectItem value="BOTH">Both</SelectItem>
                        </SelectContent>
                      </Select>
                      {internTrackError && <p className="text-sm text-destructive">{internTrackError}</p>}
                    </div>
                  )}
                </div>
              );
            })}
            {form.formState.errors.members && typeof form.formState.errors.members.message === "string" && (
              <p className="text-sm text-destructive">{form.formState.errors.members.message}</p>
            )}
          </div>
          {/* Terms */}
          <div className="flex flex-row items-center space-x-3">
            <Checkbox
              id="acceptTerms"
              checked={form.watch("acceptTerms")}
              onCheckedChange={(checked) => form.setValue("acceptTerms", !!checked)}
            />
            <Label htmlFor="acceptTerms" className="cursor-pointer font-normal text-[#1d1a17]">
              I have read and accepted the{" "}
              <Link href="/terms" className="underline text-[#17646E]">Terms and Conditions</Link>
            </Label>
          </div>
          {form.formState.errors.acceptTerms && (
            <p className="text-sm text-destructive">{form.formState.errors.acceptTerms.message}</p>
          )}
          <Button
            type="submit"
            disabled={mutation.isPending}
            className="bg-[#17646E] hover:bg-[#152060] text-[#fffbf8] rounded-full px-9 py-6 text-base"
          >
            {mutation.isPending ? "Submitting..." : "Submit"}
          </Button>
        </form>
      </div>
    </SiteLayout>
  );
}
