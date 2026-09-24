import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { AppLayout } from "@/components/layout/app-layout";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { Bell, BellRing, Eye, IndianRupee, Loader2, Mail, RefreshCw, SendHorizonal } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface InstallmentSummary {
  number: number;
  type: string;
  amount: number;
  status: "PENDING" | "PAID" | "FAILED";
  paidAt: string | null;
}

interface PaymentOverviewEntry {
  applicationId: string;
  userId: string | null;
  name: string;
  email: string;
  type: string;
  status: string;
  totalAmount: number;
  totalPaid: number;
  pendingAmount: number;
  installments: InstallmentSummary[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatINR(amount: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}

function statusBadge(status: string) {
  const map: Record<string, string> = {
    PAID: "bg-green-100 text-green-800",
    PENDING: "bg-yellow-100 text-yellow-800",
    FAILED: "bg-red-100 text-red-800",
    PARTIALLY_PAID: "bg-blue-100 text-blue-800",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${map[status] ?? "bg-gray-100 text-gray-700"}`}
    >
      {status.replace("_", " ")}
    </span>
  );
}

// ─── Tab-scoped table ─────────────────────────────────────────────────────────

function FeeTable({
  applicationType,
  label,
}: {
  applicationType: string;
  label: string;
}) {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  // Track which row action is in-flight so we can show per-row spinners
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);
  const [pendingNotif, setPendingNotif] = useState<string | null>(null);

  const { data, isLoading, isError, refetch } = useQuery<PaymentOverviewEntry[]>({
    queryKey: ["admin-payments-overview", applicationType],
    queryFn: async () => {
      const res = await fetch(
        `/api/admin/payments/overview?type=${applicationType}`,
        { credentials: "include" }
      );
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });

  const notifyMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/admin/payments/notify-all", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ applicationType }),
      });
      if (!res.ok) throw new Error("Failed to send reminders");
      return res.json();
    },
    onSuccess: (result) => {
      toast({ title: "Reminders sent", description: result.message });
      queryClient.invalidateQueries({ queryKey: ["admin-payments-overview", applicationType] });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to send payment reminders.", variant: "destructive" });
    },
  });

  // Per-row: send email reminder
  const sendEmailToOne = async (applicationId: string, email: string) => {
    setPendingEmail(applicationId);
    try {
      const res = await fetch(`/api/admin/payments/${applicationId}/send-email`, {
        method: "POST",
        credentials: "include",
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.message || "Failed");
      toast({ title: "Email sent", description: `Payment reminder sent to ${email}` });
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Failed to send email.", variant: "destructive" });
    } finally {
      setPendingEmail(null);
    }
  };

  // Per-row: send in-app notification
  const sendNotifToOne = async (applicationId: string, name: string) => {
    setPendingNotif(applicationId);
    try {
      const res = await fetch(`/api/admin/payments/${applicationId}/send-notification`, {
        method: "POST",
        credentials: "include",
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.message || "Failed");
      toast({ title: "Notification sent", description: `In-app reminder sent to ${name}` });
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Failed to send notification.", variant: "destructive" });
    } finally {
      setPendingNotif(null);
    }
  };

  // Determine pending count (those who still owe money)
  const pendingCount = (data ?? []).filter((e) => e.pendingAmount > 0).length;

  if (isLoading) {
    return (
      <div className="space-y-2 p-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <div className="p-6 text-center text-red-500">
        Failed to load data.{" "}
        <Button variant="ghost" onClick={() => refetch()}>
          Retry
        </Button>
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="space-y-4">
        {/* Header row */}
        <div className="flex items-center justify-between px-1">
          <p className="text-sm text-muted-foreground">
            {data?.length ?? 0} {label}
            {pendingCount > 0 && (
              <span className="ml-2 text-yellow-600">
                · {pendingCount} with pending fees
              </span>
            )}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              className="gap-1"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Refresh
            </Button>
            <Button
              size="sm"
              className="gap-1"
              disabled={notifyMutation.isPending || pendingCount === 0}
              onClick={() => notifyMutation.mutate()}
            >
              <BellRing className="h-3.5 w-3.5" />
              {notifyMutation.isPending ? "Sending…" : `Notify All (${pendingCount})`}
            </Button>
          </div>
        </div>

        {/* Table */}
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead className="text-right">Reg. Fee</TableHead>
                <TableHead className="text-right">Installment 1</TableHead>
                <TableHead className="text-right">Installment 2</TableHead>
                <TableHead className="text-right">Total Paid</TableHead>
                <TableHead className="text-right">Pending</TableHead>
                <TableHead className="text-right">Total Fee</TableHead>
                <TableHead className="text-center">View</TableHead>
                <TableHead className="text-center">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(data ?? []).length === 0 && (
                <TableRow>
                  <TableCell colSpan={10} className="text-center text-muted-foreground py-8">
                    No {label.toLowerCase()} found.
                  </TableCell>
                </TableRow>
              )}
              {(data ?? []).map((entry) => {
                const reg = entry.installments.find((i) => i.number === 1);
                const inst1 = entry.installments.find((i) => i.number === 2);
                const inst2 = entry.installments.find((i) => i.number === 3);
                const isFullyPaid = entry.pendingAmount === 0;
                const hasUser = !!entry.userId;

                return (
                  <TableRow key={entry.applicationId}>
                    <TableCell className="font-medium">{entry.name}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {entry.email}
                    </TableCell>
                    {/* Registration fee */}
                    <TableCell className="text-right">
                      {reg ? (
                        <div className="flex flex-col items-end gap-0.5">
                          <span className="text-sm font-medium">{formatINR(reg.amount)}</span>
                          {statusBadge(reg.status)}
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-xs">—</span>
                      )}
                    </TableCell>
                    {/* Installment 1 */}
                    <TableCell className="text-right">
                      {inst1 ? (
                        <div className="flex flex-col items-end gap-0.5">
                          <span className="text-sm font-medium">{formatINR(inst1.amount)}</span>
                          {statusBadge(inst1.status)}
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-xs">—</span>
                      )}
                    </TableCell>
                    {/* Installment 2 */}
                    <TableCell className="text-right">
                      {inst2 ? (
                        <div className="flex flex-col items-end gap-0.5">
                          <span className="text-sm font-medium">{formatINR(inst2.amount)}</span>
                          {statusBadge(inst2.status)}
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-xs">—</span>
                      )}
                    </TableCell>
                    {/* Totals */}
                    <TableCell className="text-right font-semibold text-green-700">
                      {formatINR(entry.totalPaid)}
                    </TableCell>
                    <TableCell className="text-right font-semibold text-yellow-700">
                      {formatINR(entry.pendingAmount)}
                    </TableCell>
                    <TableCell className="text-right font-semibold">
                      {formatINR(entry.totalAmount)}
                    </TableCell>
                    {/* View */}
                    <TableCell className="text-center">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="gap-1"
                        onClick={() =>
                          navigate(`/app/admin/applications/${entry.applicationId}/payment-details`)
                        }
                      >
                        <Eye className="h-3.5 w-3.5" />
                        View
                      </Button>
                    </TableCell>
                    {/* Actions */}
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-1">
                        {/* Email reminder */}
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7"
                              disabled={isFullyPaid || pendingEmail === entry.applicationId}
                              onClick={() => sendEmailToOne(entry.applicationId, entry.email)}
                            >
                              {pendingEmail === entry.applicationId ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <Mail className="h-3.5 w-3.5" />
                              )}
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent side="top">
                            {isFullyPaid ? "Fully paid — no reminder needed" : "Send email reminder"}
                          </TooltipContent>
                        </Tooltip>
                        {/* In-app notification */}
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7"
                              disabled={!hasUser || isFullyPaid || pendingNotif === entry.applicationId}
                              onClick={() => sendNotifToOne(entry.applicationId, entry.name)}
                            >
                              {pendingNotif === entry.applicationId ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <Bell className="h-3.5 w-3.5" />
                              )}
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent side="top">
                            {!hasUser
                              ? "No account linked — cannot send notification"
                              : isFullyPaid
                              ? "Fully paid — no reminder needed"
                              : "Send in-app notification"}
                          </TooltipContent>
                        </Tooltip>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </div>
    </TooltipProvider>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function AdminFeeTrackerPage() {
  const { toast } = useToast();

  const sendAllMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/admin/payments/notify-all-types", {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to send bulk reminders");
      return res.json();
    },
    onSuccess: (result) => {
      toast({
        title: "Bulk emails sent",
        description: result.message,
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to send bulk emails.",
        variant: "destructive",
      });
    },
  });

  return (
    <AppLayout title="Fee Tracker">
      <div className="container mx-auto py-6 space-y-6 max-w-7xl">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-primary/10 p-2">
            <IndianRupee className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Fee Tracker</h1>
            <p className="text-sm text-muted-foreground">
              Monitor payment status and send reminders across all participant
              types.
            </p>
          </div>
        </div>
        {/* Global Send All button */}
        <Button
          className="gap-2"
          disabled={sendAllMutation.isPending}
          onClick={() => sendAllMutation.mutate()}
        >
          {sendAllMutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <SendHorizonal className="h-4 w-4" />
          )}
          {sendAllMutation.isPending ? "Sending…" : "Send All Emails"}
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">All Participants</CardTitle>
          <CardDescription>
            Select a tab to view Founders, Co-Founders, or Interns.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="FOUNDER">
            <TabsList className="mb-4">
              <TabsTrigger value="FOUNDER">Founders</TabsTrigger>
              <TabsTrigger value="COFOUNDER">Co-Founders</TabsTrigger>
              <TabsTrigger value="LEARNER">Interns</TabsTrigger>
            </TabsList>

            <TabsContent value="FOUNDER">
              <FeeTable applicationType="FOUNDER" label="Founders" />
            </TabsContent>
            <TabsContent value="COFOUNDER">
              <FeeTable applicationType="COFOUNDER" label="Co-Founders" />
            </TabsContent>
            <TabsContent value="LEARNER">
              <FeeTable applicationType="LEARNER" label="Interns" />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
      </div>
    </AppLayout>
  );
}
