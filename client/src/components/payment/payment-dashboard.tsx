import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Download, Clock, Check, X, CreditCard } from "lucide-react";

interface PaymentDashboardProps {
  applicationId: string;
}

export function PaymentDashboard({ applicationId }: PaymentDashboardProps) {
  const { data: config } = useQuery({
    queryKey: ["/api/config"],
    queryFn: async () => {
      const res = await fetch("/api/config");
      if (!res.ok) throw new Error("Failed to fetch config");
      return res.json();
    },
  });
  const { data: paymentStatus, isLoading, refetch } = useQuery({
    queryKey: ["payment-status", applicationId],
    queryFn: async () => {
      const res = await fetch(`/api/applications/${applicationId}/payment-status`);
      if (!res.ok) throw new Error("Failed to fetch payment status");
      return res.json();
    },
  });

  if (isLoading) {
    return <div className="text-center py-8">Loading payment information...</div>;
  }

  if (!paymentStatus) {
    return null;
  }

  const {
    totalAmount,
    paidAmount,
    pendingAmount,
    status,
    installments,
    canPayNow,
    offerExpired,
    offerExpiresAt,
    retryInfo,
    nextInstallment,
  } = paymentStatus;

  const progressPercent = totalAmount > 0 ? (paidAmount / totalAmount) * 100 : 0;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "PAID":
        return <Badge className="bg-green-600"><Check className="w-3 h-3 mr-1" /> Paid</Badge>;
      case "PENDING":
        return <Badge variant="outline"><Clock className="w-3 h-3 mr-1" /> Pending</Badge>;
      case "FAILED":
        return <Badge variant="destructive"><X className="w-3 h-3 mr-1" /> Failed</Badge>;
      case "OVERDUE":
        return <Badge variant="destructive">Overdue</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  const getRemainingTime = () => {
    if (!offerExpiresAt) return null;
    const now = new Date();
    const expiry = new Date(offerExpiresAt);
    const diffMs = expiry.getTime() - now.getTime();
    
    if (diffMs <= 0) return "Expired";
    
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    
    return `${hours}h ${minutes}m remaining`;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Payment Information</CardTitle>
        <CardDescription>Track your installment payments</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Payment Summary */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-4">
          <div className="text-center">
            <div className="text-base sm:text-2xl font-bold break-all">₹{totalAmount.toLocaleString()}</div>
            <div className="text-xs sm:text-sm text-muted-foreground">Total Amount</div>
          </div>
          <div className="text-center">
            <div className="text-base sm:text-2xl font-bold text-green-600 break-all">₹{paidAmount.toLocaleString()}</div>
            <div className="text-xs sm:text-sm text-muted-foreground">Paid</div>
          </div>
          <div className="text-center">
            <div className="text-base sm:text-2xl font-bold text-orange-600 break-all">₹{pendingAmount.toLocaleString()}</div>
            <div className="text-xs sm:text-sm text-muted-foreground">Pending</div>
          </div>
        </div>

        {/* Progress Bar */}
        <div>
          <div className="flex justify-between text-sm mb-2">
            <span>Payment Progress</span>
            <span className="font-semibold">{progressPercent.toFixed(0)}%</span>
          </div>
          <Progress value={progressPercent} className="h-2" />
        </div>

        {/* Expiry Timer */}
        {status === "OFFER" && offerExpiresAt && !offerExpired && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-yellow-600" />
              <div>
                <div className="font-semibold text-yellow-800">Payment Deadline</div>
                <div className="text-sm text-yellow-700">{getRemainingTime()}</div>
              </div>
            </div>
          </div>
        )}

        {/* Offer Expired */}
        {offerExpired && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-center gap-2">
              <X className="w-5 h-5 text-red-600" />
              <div>
                <div className="font-semibold text-red-800">Offer Expired</div>
                <div className="text-sm text-red-700">Please contact admin to extend the deadline.</div>
              </div>
            </div>
          </div>
        )}

        {/* Installments List */}
        <div>
          <h4 className="font-semibold mb-3">Installments</h4>
          <div className="space-y-3">
            {installments.map((installment: any) => (
              <div key={installment.id} className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">
                      {installment.number === 1 ? "Registration Fee" : `Installment ${installment.number - 1}`}
                    </span>
                    {getStatusBadge(installment.status)}
                  </div>
                  <div className="text-sm text-muted-foreground mt-1">
                    Due: {new Date(installment.dueDate).toLocaleDateString()}
                  </div>
                  {installment.paidAt && (
                    <div className="text-sm text-green-600">
                      Paid on: {new Date(installment.paidAt).toLocaleDateString()}
                    </div>
                  )}
                </div>
                <div className="text-right">
                  <div className="font-bold">₹{installment.amount.toLocaleString()}</div>
                  {installment.status === "PAID" && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="mt-1"
                      onClick={() => window.open(`/api/applications/${applicationId}/installments/${installment.id}/invoice`, "_blank")}
                    >
                      <Download className="w-4 h-4 mr-1" />
                      Invoice
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Pay Now Button - redirects to payment portal (rooman.net) for Razorpay compatibility */}
        {nextInstallment && canPayNow && !offerExpired && (
          <div className="pt-4">
            <Button
              className="w-full gap-2"
              size="lg"
              onClick={() => {
                const url = config?.paymentPortalUrl
                  ? `${config.paymentPortalUrl.replace(/\/$/, "")}/payment/${applicationId}`
                  : `/payment/${applicationId}`;
                window.open(url, "_blank");
              }}
            >
              <CreditCard className="h-4 w-4" />
              Pay Now
            </Button>
          </div>
        )}

        {/* Retry Info */}
        {retryInfo && retryInfo.attemptsLeft < 2 && canPayNow && (
          <div className="text-sm text-orange-600 text-center">
            ⚠️ {retryInfo.attemptsLeft} payment attempt{retryInfo.attemptsLeft !== 1 ? "s" : ""} remaining
          </div>
        )}

        {/* Cooldown Message */}
        {retryInfo && retryInfo.cooldownEndsAt && !canPayNow && (
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
            <div className="text-sm text-orange-800">
              Too many failed attempts. Please wait until{" "}
              {new Date(retryInfo.cooldownEndsAt).toLocaleTimeString()} to retry.
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
