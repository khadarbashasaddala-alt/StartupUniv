import { useQuery } from "@tanstack/react-query";
import { useRoute } from "wouter";
import { AppLayout } from "@/components/layout/app-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Download,
  IndianRupee,
  XCircle,
  Mail,
  Phone,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";

interface PaymentStatus {
  totalAmount: number;
  paidAmount: number;
  pendingAmount: number;
  status: string;
  installments: Array<{
    id: string;
    number: number;
    type: string;
    amount: number;
    status: string;
    paidAt?: Date;
    dueDate?: Date;
  }>;
  canPayNow: boolean;
  offerExpired: boolean;
  offerExpiresAt?: Date;
  retryInfo: {
    attemptsLeft: number;
    cooldownEndsAt?: Date | null;
  };
  nextInstallment?: {
    id: string;
    number: number;
    amount: number;
    dueDate?: Date;
  };
}

export default function StudentPaymentPage() {
  const [, params] = useRoute("/app/applications/:id/payment");
  const applicationId = params?.id;

  const { data: config } = useQuery({
    queryKey: ["/api/config"],
    queryFn: async () => {
      const res = await fetch("/api/config");
      if (!res.ok) throw new Error("Failed to fetch config");
      return res.json();
    },
  });

  const { data: paymentStatus, isLoading } = useQuery<PaymentStatus>({
    queryKey: [`/applications/${applicationId}/payment-status`],
    enabled: !!applicationId,
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const handlePayNow = () => {
    const url = config?.paymentPortalUrl
      ? `${config.paymentPortalUrl.replace(/\/$/, "")}/payment/${applicationId}`
      : `/payment/${applicationId}`;
    window.open(url, "_blank");
  };

  if (!applicationId) {
    return (
      <AppLayout>
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Invalid Application</AlertTitle>
          <AlertDescription>Application ID not found.</AlertDescription>
        </Alert>
      </AppLayout>
    );
  }

  if (isLoading) {
    return (
      <AppLayout>
        <div className="max-w-4xl mx-auto p-6 space-y-6">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </AppLayout>
    );
  }

  if (!paymentStatus) {
    return (
      <AppLayout>
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Payment Information Not Found</AlertTitle>
          <AlertDescription>
            Unable to load payment details. Please contact support.
          </AlertDescription>
        </Alert>
      </AppLayout>
    );
  }

  const progress = (paymentStatus.paidAmount / paymentStatus.totalAmount) * 100;
  const allPaid = paymentStatus.paidAmount >= paymentStatus.totalAmount;

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto p-4 sm:p-6 space-y-4 sm:space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold">Payment Portal</h1>
          <p className="text-muted-foreground">
            Complete your payment to secure your seat in StartupUniv
          </p>
        </div>

        {/* Offer Expiry Warning */}
        {!allPaid && paymentStatus.offerExpiresAt && !paymentStatus.offerExpired && (
          <Alert className="border-yellow-500 bg-yellow-50">
            <Clock className="h-4 w-4 text-yellow-600" />
            <AlertTitle className="text-yellow-800">Payment Deadline</AlertTitle>
            <AlertDescription className="text-yellow-700">
              Your offer expires{" "}
              <strong>
                {formatDistanceToNow(new Date(paymentStatus.offerExpiresAt), {
                  addSuffix: true,
                })}
              </strong>{" "}
              on {format(new Date(paymentStatus.offerExpiresAt), "PPpp")}
            </AlertDescription>
          </Alert>
        )}

        {/* Offer Expired */}
        {paymentStatus.offerExpired && (
          <Alert variant="destructive">
            <XCircle className="h-4 w-4" />
            <AlertTitle>Offer Expired</AlertTitle>
            <AlertDescription>
              Your payment offer has expired. Please contact admin to request an extension.
            </AlertDescription>
          </Alert>
        )}

        {/* Cooldown Warning */}
        {paymentStatus.retryInfo.cooldownEndsAt && (
          <Alert className="border-orange-500 bg-orange-50">
            <AlertCircle className="h-4 w-4 text-orange-600" />
            <AlertTitle className="text-orange-800">Payment Retry Limit</AlertTitle>
            <AlertDescription className="text-orange-700">
              You can retry payment after{" "}
              {formatDistanceToNow(new Date(paymentStatus.retryInfo.cooldownEndsAt), {
                addSuffix: true,
              })}
              . Attempts remaining: {paymentStatus.retryInfo.attemptsLeft}
            </AlertDescription>
          </Alert>
        )}

        {/* All Paid Success */}
        {allPaid && (
          <Alert className="border-green-500 bg-green-50">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            <AlertTitle className="text-green-800">Payment Complete!</AlertTitle>
            <AlertDescription className="text-green-700">
              Congratulations! You have completed all payments. Welcome to StartupUniv!
            </AlertDescription>
          </Alert>
        )}

        {/* Payment Overview */}
        <Card>
          <CardHeader>
            <CardTitle>Payment Overview</CardTitle>
            <CardDescription>
              Total Program Fee: ₹{paymentStatus.totalAmount.toLocaleString()}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="text-center p-4 bg-accent rounded-lg">
                <p className="text-sm text-muted-foreground">Total Amount</p>
                <p className="text-2xl font-bold text-primary">
                  ₹{paymentStatus.totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
              </div>
              <div className="text-center p-4 bg-green-50 rounded-lg">
                <p className="text-sm text-muted-foreground">Paid</p>
                <p className="text-2xl font-bold text-green-600">
                  ₹{paymentStatus.paidAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
              </div>
              <div className="text-center p-4 bg-orange-50 rounded-lg">
                <p className="text-sm text-muted-foreground">Pending</p>
                <p className="text-2xl font-bold text-orange-600">
                  ₹{paymentStatus.pendingAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Payment Progress</span>
                <span>{progress.toFixed(0)}%</span>
              </div>
              <Progress value={progress} className="h-2" />
            </div>
          </CardContent>
        </Card>

        {/* Installments */}
        <Card>
          <CardHeader>
            <CardTitle>Payment Installments</CardTitle>
            <CardDescription>
              Pay 1 registration fee + 2 installments to complete your registration
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {paymentStatus.installments.map((installment) => (
                <div
                  key={installment.id}
                  className={`p-4 border rounded-lg ${
                    installment.status === "PAID"
                      ? "bg-green-50 border-green-200"
                      : installment.status === "FAILED"
                      ? "bg-red-50 border-red-200"
                      : "bg-white border-gray-200"
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <div
                        className={`flex items-center justify-center w-10 h-10 rounded-full flex-shrink-0 ${
                          installment.status === "PAID"
                            ? "bg-green-600 text-white"
                            : installment.status === "FAILED"
                            ? "bg-red-600 text-white"
                            : "bg-gray-400 text-white"
                        }`}
                      >
                        {installment.number}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-base">
                          {installment.number === 1 ? "Registration Fee" : `Installment ${installment.number - 1}`}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {installment.dueDate
                            ? `Due: ${format(new Date(installment.dueDate), "MMM d, yyyy")}`
                            : installment.number === 1
                            ? "Due: Immediately"
                            : ""}
                        </p>
                        {installment.paidAt && (
                          <p className="text-sm text-green-600 mt-1">
                            Paid on {format(new Date(installment.paidAt), "PPpp")}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4">
                      <div className="flex flex-col sm:items-end">
                        <p className="font-bold text-lg">
                          ₹{installment.amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </p>
                        <Badge
                          variant={
                            installment.status === "PAID"
                              ? "default"
                              : installment.status === "FAILED"
                              ? "destructive"
                              : "secondary"
                          }
                          className="mt-1 w-fit"
                        >
                          {installment.status}
                        </Badge>
                      </div>

                      {installment.status === "PENDING" &&
                        paymentStatus.canPayNow &&
                        paymentStatus.nextInstallment?.id === installment.id && (
                          <Button
                            onClick={handlePayNow}
                            className="bg-green-600 hover:bg-green-700 w-full sm:w-auto"
                            disabled={paymentStatus.offerExpired}
                            size="default"
                          >
                            <IndianRupee className="h-4 w-4 mr-2" />
                            Pay Now
                          </Button>
                        )}

                      {installment.status === "PAID" && (
                        <Button variant="outline" size="sm" className="w-full sm:w-auto">
                          <Download className="h-4 w-4 mr-2" />
                          Invoice
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Need Help */}
        <Card>
          <CardHeader>
            <CardTitle>Need Help?</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              If you have any questions or issues with payment, please contact us at:
            </p>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">Email: hello@startupvarsity.com</span>
              </div>
              <div className="flex items-center gap-3">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">Phone: Contact admin</span>
              </div>
            </div>
          </CardContent>
        </Card>

      </div>
    </AppLayout>
  );
}
