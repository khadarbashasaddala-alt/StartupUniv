import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation, useRoute } from "wouter";
import { AppLayout } from "@/components/layout/app-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  Download,
  IndianRupee,
  XCircle,
  AlertCircle,
  FileText,
  Mail,
} from "lucide-react";
import { format } from "date-fns";

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
    paidAt?: string;
    dueDate?: string;
    razorpayPaymentId?: string;
    razorpayOrderId?: string;
  }>;
  canPayNow: boolean;
  offerExpired: boolean;
  offerExpiresAt?: string;
  retryInfo: {
    attemptsLeft: number;
    cooldownEndsAt?: string | null;
  };
  nextInstallment?: {
    id: string;
    number: number;
    amount: number;
    dueDate?: string;
  };
}

interface ApplicationInfo {
  id: string;
  type: string;
  status: string;
  formData?: any;
  formJson?: any;
  totalPaidAmount?: string;
  paymentConfirmed?: boolean;
}

export default function AdminPaymentDetailsPage() {
  const [location, setLocation] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [match, params] = useRoute("/app/admin/applications/:id/payment-details");
  const applicationId = params?.id;
  
  // Check if we came from users page
  const searchParams = new URLSearchParams(window.location.search);
  const fromUsers = searchParams.get("from") === "users";
  const userId = searchParams.get("userId");

  // Fetch application info
  const { data: application, isLoading: loadingApp } = useQuery<ApplicationInfo>({
    queryKey: ["/api/admin/applications", applicationId],
    queryFn: async () => {
      const data = await apiRequest("GET", `/admin/applications/${applicationId}`);
      return data;
    },
    enabled: !!applicationId && !!user,
  });

  // Fetch payment status
  const { data: paymentStatus, isLoading: loadingPayment } = useQuery<PaymentStatus>({
    queryKey: [`/applications/${applicationId}/payment-status`],
    queryFn: async () => {
      const res = await fetch(`/api/applications/${applicationId}/payment-status`);
      if (!res.ok) throw new Error("Failed to fetch payment status");
      return res.json();
    },
    enabled: !!applicationId && !!user,
  });

  // Find next pending installment
  const nextPendingInstallment = paymentStatus?.installments.find((i) => i.status === "PENDING");

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "PAID":
        return (
          <Badge className="bg-green-600">
            <CheckCircle2 className="w-3 h-3 mr-1" /> Paid
          </Badge>
        );
      case "PENDING":
        return (
          <Badge variant="outline">
            <Clock className="w-3 h-3 mr-1" /> Pending
          </Badge>
        );
      case "FAILED":
        return (
          <Badge variant="destructive">
            <XCircle className="w-3 h-3 mr-1" /> Failed
          </Badge>
        );
      default:
        return <Badge>{status}</Badge>;
    }
  };

  const handleDownloadInvoice = async (installmentId: string) => {
    try {
      window.open(`/api/applications/${applicationId}/installments/${installmentId}/invoice`, "_blank");
    } catch (error) {
      console.error("Error downloading invoice:", error);
    }
  };

  // Send payment reminder mutation
  const sendReminderMutation = useMutation({
    mutationFn: async () => {
      const data = await apiRequest("POST", `/admin/applications/${applicationId}/send-payment-reminder`);
      return data;
    },
    onSuccess: (data) => {
      toast({
        title: "Reminder Sent",
        description: `Payment reminder email sent successfully for ${data.installment?.number === 1 ? "Registration Fee" : `Installment ${data.installment?.number - 1}`} (₹${data.installment?.amount?.toLocaleString()})`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to Send Reminder",
        description: error.message || "Unable to send payment reminder email",
        variant: "destructive",
      });
    },
  });

  if (loadingApp || loadingPayment) {
    return (
      <AppLayout>
        <div className="container mx-auto p-6 space-y-6">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </AppLayout>
    );
  }

  if (!application || !paymentStatus) {
    return (
      <AppLayout>
        <div className="container mx-auto p-6">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>Failed to load payment details.</AlertDescription>
          </Alert>
        </div>
      </AppLayout>
    );
  }

  const formData = application.formData || application.formJson || {};
  const applicantName = formData.fullName || formData.name || "Unknown";
  const progressPercent = paymentStatus.totalAmount > 0 
    ? (paymentStatus.paidAmount / paymentStatus.totalAmount) * 100 
    : 0;

  return (
    <AppLayout>
      <div className="container mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => {
                if (fromUsers && userId) {
                  setLocation(`/app/admin/users/${userId}`);
                } else {
                  setLocation(`/app/admin/applications/${applicationId}`);
                }
              }}
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold text-foreground">Payment Details</h1>
              <p className="text-muted-foreground mt-1">
                {applicantName} - {application.type}
              </p>
            </div>
          </div>
        </div>

        {/* Payment Summary */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Payment Summary</CardTitle>
                <CardDescription>Complete payment overview for this application</CardDescription>
              </div>
              {nextPendingInstallment && (
                <Button
                  onClick={() => sendReminderMutation.mutate()}
                  disabled={sendReminderMutation.isPending}
                  variant="outline"
                  className="gap-2"
                >
                  <Mail className="h-4 w-4" />
                  {sendReminderMutation.isPending ? "Sending..." : "Send Payment Reminder"}
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Total Amount Info */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 bg-muted rounded-lg">
                <p className="text-sm text-muted-foreground mb-1">Total Amount</p>
                <p className="text-2xl font-bold">₹{paymentStatus.totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
              </div>
              <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                <p className="text-sm text-green-700 mb-1">Paid Amount</p>
                <p className="text-2xl font-bold text-green-700">₹{paymentStatus.paidAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
              </div>
              <div className="p-4 bg-orange-50 rounded-lg border border-orange-200">
                <p className="text-sm text-orange-700 mb-1">Pending Amount</p>
                <p className="text-2xl font-bold text-orange-700">₹{paymentStatus.pendingAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
              </div>
            </div>

            {/* Progress Bar */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Payment Progress</span>
                <span className="text-sm text-muted-foreground">{progressPercent.toFixed(1)}%</span>
              </div>
              <Progress value={progressPercent} className="h-3" />
            </div>

            {/* Payment Status Badge */}
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">Overall Status:</span>
              {getStatusBadge(paymentStatus.status)}
            </div>
          </CardContent>
        </Card>

        {/* Installments Details */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Payment Installments
            </CardTitle>
            <CardDescription>Detailed breakdown of all payment installments</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
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
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div className="flex items-start gap-4 flex-1">
                      <div
                        className={`flex items-center justify-center w-12 h-12 rounded-full flex-shrink-0 ${
                          installment.status === "PAID"
                            ? "bg-green-600 text-white"
                            : installment.status === "FAILED"
                            ? "bg-red-600 text-white"
                            : "bg-gray-400 text-white"
                        }`}
                      >
                        {installment.number}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="font-semibold text-lg">
                            {installment.number === 1 ? "Registration Fee" : `Installment ${installment.number - 1}`}
                          </span>
                          {getStatusBadge(installment.status)}
                        </div>
                        <div className="space-y-1 text-sm">
                          <p className="text-muted-foreground">
                            <strong>Amount:</strong> ₹{installment.amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </p>
                          {installment.dueDate && (
                            <p className="text-muted-foreground">
                              <strong>Due Date:</strong> {format(new Date(installment.dueDate), "PPP")}
                            </p>
                          )}
                          {installment.paidAt && (
                            <p className="text-green-600">
                              <strong>Paid On:</strong> {format(new Date(installment.paidAt), "PPP 'at' p")}
                            </p>
                          )}
                          {installment.razorpayPaymentId && (
                            <p className="text-muted-foreground">
                              <strong>Transaction ID:</strong> {installment.razorpayPaymentId}
                            </p>
                          )}
                          {installment.razorpayOrderId && (
                            <p className="text-muted-foreground">
                              <strong>Order ID:</strong> {installment.razorpayOrderId}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {installment.status === "PAID" && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDownloadInvoice(installment.id)}
                        >
                          <Download className="h-4 w-4 mr-2" />
                          Download Invoice
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Additional Information */}
        {paymentStatus.offerExpiresAt && (
          <Card>
            <CardHeader>
              <CardTitle>Payment Offer Information</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <p className="text-sm">
                  <strong>Offer Expires At:</strong> {format(new Date(paymentStatus.offerExpiresAt), "PPP 'at' p")}
                </p>
                {paymentStatus.offerExpired && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>This payment offer has expired.</AlertDescription>
                  </Alert>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Back Button */}
        <div className="flex justify-end">
          <Button 
            onClick={() => {
              if (fromUsers && userId) {
                setLocation(`/app/admin/users/${userId}`);
              } else {
                setLocation(`/app/admin/applications/${applicationId}`);
              }
            }}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            {fromUsers ? "Back to Users Page" : "Back to Application Details"}
          </Button>
        </div>
      </div>
    </AppLayout>
  );
}
