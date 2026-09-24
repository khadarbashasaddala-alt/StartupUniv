import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AppLayout } from "@/components/layout/app-layout";
import { Button } from "@/components/ui/button";
import { IndianRupee, CheckCircle2, Clock, AlertCircle, CreditCard, Lock } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface InstallmentItem {
  id: string;
  number: number;
  type: string;
  amount: number;
  status: "PENDING" | "PAID" | "FAILED";
  paidAt: string | null;
  dueDate: string | null;
  exists: boolean;
}

interface PaymentStatus {
  totalAmount: number;
  paidAmount: number;
  pendingAmount: number;
  status: string;
  installments: InstallmentItem[];
  canPayNow: boolean;
  offerExpired: boolean;
  offerExpiresAt: string | null;
  nextInstallment: InstallmentItem | null;
}

interface MyApplication {
  id: string;
  type: string;
  status: string;
  formJson: any;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatINR(amount: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function installmentLabel(inst: InstallmentItem) {
  if (inst.type === "REGISTRATION_FEE" || inst.number === 1) return "Registration Fee";
  return `Installment ${inst.number - 1}`;
}

function InstallmentStatusIcon({ status }: { status: string }) {
  if (status === "PAID") return <CheckCircle2 className="h-5 w-5 text-green-600" />;
  if (status === "FAILED") return <AlertCircle className="h-5 w-5 text-red-500" />;
  return <Clock className="h-5 w-5 text-yellow-500" />;
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function MyFeesPage() {
  const [, setLocation] = useLocation();

  // Step 1: fetch the user's own application
  const {
    data: myApplication,
    isLoading: appLoading,
    isError: appError,
  } = useQuery<MyApplication>({
    queryKey: ["my-application"],
    queryFn: async () => {
      const res = await fetch("/api/auth/my-application", {
        credentials: "include",
      });
      if (!res.ok) throw new Error("No application found");
      return res.json();
    },
  });

  // Step 2: fetch payment status using applicationId
  const {
    data: paymentStatus,
    isLoading: paymentLoading,
    isError: paymentError,
  } = useQuery<PaymentStatus>({
    queryKey: ["payment-status", myApplication?.id],
    queryFn: async () => {
      const res = await fetch(
        `/api/applications/${myApplication!.id}/payment-status`,
        { credentials: "include" }
      );
      if (!res.ok) throw new Error("Failed to fetch payment status");
      return res.json();
    },
    enabled: !!myApplication?.id,
  });

  const isLoading = appLoading || (!!myApplication && paymentLoading);

  if (isLoading) {
    return (
      <AppLayout title="My Fees">
        <div className="container mx-auto py-6 space-y-4 max-w-3xl">
          <Skeleton className="h-8 w-56" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      </AppLayout>
    );
  }

  if (appError || !myApplication) {
    return (
      <AppLayout title="My Fees">
        <div className="container mx-auto py-10 max-w-3xl">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              No program application found for your account. Please contact
              support if you believe this is an error.
            </AlertDescription>
          </Alert>
        </div>
      </AppLayout>
    );
  }

  if (paymentError || !paymentStatus) {
    return (
      <AppLayout title="My Fees">
        <div className="container mx-auto py-10 max-w-3xl">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Unable to load your payment details. Please refresh the page or
              contact support.
            </AlertDescription>
          </Alert>
        </div>
      </AppLayout>
    );
  }

  const progressPercent =
    paymentStatus.totalAmount > 0
      ? Math.round((paymentStatus.paidAmount / paymentStatus.totalAmount) * 100)
      : 0;

  const isFullyPaid = paymentStatus.pendingAmount === 0;

  // Index of the first PENDING installment — only that one gets "Pay Now"
  const firstPendingIndex = paymentStatus.installments.findIndex(
    (i) => i.status === "PENDING"
  );

  return (
    <AppLayout title="My Fees">
      <div className="container mx-auto py-6 space-y-6 max-w-3xl">
        {/* Page header */}
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-primary/10 p-2">
            <IndianRupee className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">My Fees</h1>
            <p className="text-sm text-muted-foreground">
              Your complete fee payment summary and installment tracker.
            </p>
          </div>
        </div>

        {/* Summary Card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center justify-between">
              Payment Summary
              {isFullyPaid ? (
                <Badge className="bg-green-100 text-green-800 border-green-200">
                  Fully Paid
                </Badge>
              ) : (
                <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200">
                  {paymentStatus.pendingAmount > 0 ? "Pending" : "Paid"}
                </Badge>
              )}
            </CardTitle>
            <CardDescription>
              Overview of your total program fee and payments made so far.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-4">
              <div className="text-center">
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
                  Total Fee
                </p>
                <p className="text-sm sm:text-xl font-bold break-all">{formatINR(paymentStatus.totalAmount)}</p>
              </div>
              <div className="text-center border-x px-1 sm:px-2">
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
                  Paid
                </p>
                <p className="text-sm sm:text-xl font-bold text-green-600 break-all">
                  {formatINR(paymentStatus.paidAmount)}
                </p>
              </div>
              <div className="text-center">
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
                  Pending
                </p>
                <p className="text-sm sm:text-xl font-bold text-yellow-600 break-all">
                  {formatINR(paymentStatus.pendingAmount)}
                </p>
              </div>
            </div>

            {/* Progress bar */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{progressPercent}% paid</span>
                <span>
                  {formatINR(paymentStatus.paidAmount)} / {formatINR(paymentStatus.totalAmount)}
                </span>
              </div>
              <Progress value={progressPercent} className="h-2" />
            </div>
          </CardContent>
        </Card>

        {/* Installment Cards */}
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Installment Breakdown
          </h2>

          {paymentStatus.installments.map((inst, idx) => {
            const isPaid = inst.status === "PAID";
            const isPending = inst.status === "PENDING";
            // Show Pay Now only on the first unpaid installment
            const isNextDue = isPending && idx === firstPendingIndex;
            // canPayNow from server: !offerExpired && retryInfo.canRetry
            const canPay = isNextDue && paymentStatus.canPayNow;
            // Subsequent pending installments are locked until the current one is paid
            const isLocked = isPending && idx > firstPendingIndex;

            return (
              <Card
                key={inst.id}
                className={`transition-colors ${
                  isPaid
                    ? "border-green-200 bg-green-50/40"
                    : isLocked
                    ? "border-muted bg-muted/20 opacity-60"
                    : "border-yellow-200"
                }`}
              >
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-start justify-between gap-4">
                    {/* Left: info */}
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5">
                        {isLocked ? (
                          <Lock className="h-5 w-5 text-muted-foreground" />
                        ) : (
                          <InstallmentStatusIcon status={inst.status} />
                        )}
                      </div>
                      <div>
                        <p className="font-semibold text-sm">
                          {installmentLabel(inst)}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {isPaid ? (
                            <>Paid on {formatDate(inst.paidAt)}</>
                          ) : (
                            <>Due: {formatDate(inst.dueDate)}</>
                          )}
                        </p>
                        {isPaid && (
                          <Badge
                            variant="outline"
                            className="mt-1 text-xs text-green-700 border-green-300"
                          >
                            <CheckCircle2 className="h-3 w-3 mr-1" /> Paid
                          </Badge>
                        )}
                      </div>
                    </div>

                    {/* Right: amount + pay button */}
                    <div className="flex flex-col items-end gap-2 shrink-0">
                      <p className="text-lg font-bold">{formatINR(inst.amount)}</p>

                      {canPay && (
                        <Button
                          onClick={() => setLocation(`/payment/${myApplication.id}`)}
                          size="sm"
                          className="gap-2"
                        >
                          💳 Pay Now
                        </Button>
                      )}

                      {isNextDue && !paymentStatus.canPayNow && (
                        <p className="text-xs text-muted-foreground text-right max-w-[160px]">
                          {paymentStatus.offerExpired
                            ? "Offer has expired. Please contact support."
                            : "Payment temporarily unavailable. Please try again later."}
                        </p>
                      )}

                      {isLocked && (
                        <p className="text-xs text-muted-foreground text-right max-w-[160px]">
                          Pay previous installment first.
                        </p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}

          {paymentStatus.installments.length === 0 && (
            <Card className="border-dashed">
              <CardContent className="pt-6 pb-6 text-center text-muted-foreground">
                <CreditCard className="h-8 w-8 mx-auto mb-2 opacity-40" />
                <p className="text-sm">
                  No installments found. The admin will set up your payment plan
                  soon.
                </p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Fully paid banner */}
        {isFullyPaid && (
          <Alert className="border-green-200 bg-green-50 text-green-800">
            <CheckCircle2 className="h-4 w-4" />
            <AlertDescription className="font-medium">
              🎉 Your program fees are fully paid. Thank you!
            </AlertDescription>
          </Alert>
        )}
      </div>
    </AppLayout>
  );
}
