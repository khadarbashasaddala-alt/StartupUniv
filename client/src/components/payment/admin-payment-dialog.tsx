import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, AlertCircle, Info } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface AdminPaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  application: any;
}

export function AdminPaymentDialog({
  open,
  onOpenChange,
  application,
}: AdminPaymentDialogProps) {
  const [registrationFee, setRegistrationFee] = useState("10000");
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const getFeeByType = (type: string, plan?: string): number => {
    switch (type) {
      case "LEARNER":
        // LEARNER: Basic (₹1,00,000) or Premium (₹1,50,000)
        return plan === "premium" ? 150000 : 100000;
      case "PROFESSIONAL":
        return 150000;
      case "FOUNDER":
        // FOUNDER: Premium only (₹5,00,000)
        return 500000;
      case "COFOUNDER":
        // COFOUNDER: Premium only (₹3,00,000)
        return 300000;
      default:
        return 100000;
    }
  };

  const formData = (application?.formJson as any) || {};
  const plan = formData?.plan || "";
  const totalFee = getFeeByType(application?.type || "", plan);

  useEffect(() => {
    // Reset to default when dialog opens
    if (open) {
      // Use existing customFeeAmount if exists, otherwise use 10% of total fee
      const existingCustomFee = application?.customFeeAmount ? parseFloat(application.customFeeAmount) : 0;
      const defaultRegFee = existingCustomFee > 0
        ? existingCustomFee.toString()
        : Math.floor(totalFee * 0.1).toString();
      setRegistrationFee(defaultRegFee);
    }
  }, [open, application, totalFee]);

  const initiateMutation = useMutation({
    mutationFn: async (amount: number) => {
      const res = await fetch(`/api/admin/applications/${application.id}/initiate-payment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ registrationFee: amount }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to initiate payment");
      }

      return res.json();
    },
    onSuccess: (data) => {
      if (data.alreadyPaid) {
        toast({
          title: "Payment Already Exists",
          description: data.message,
        });
      } else {
        toast({
          title: "Payment Initiated",
          description: `Payment email sent successfully to user. Offer expires in 24 hours.`,
        });
        onOpenChange(false);
      }
      queryClient.invalidateQueries({ queryKey: ["application", application.id] });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to Initiate Payment",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSubmit = () => {
    const amount = parseInt(registrationFee);
    
    if (isNaN(amount) || amount < 1 || amount > 400000) {
      toast({
        title: "Invalid Amount",
        description: "Please enter an amount between ₹1 and ₹4,00,000",
        variant: "destructive",
      });
      return;
    }

    // Validate registration fee is less than total fee
    if (amount >= totalFee) {
      toast({
        title: "Invalid Registration Fee",
        description: `Registration fee must be less than total fee (₹${totalFee.toLocaleString()})`,
        variant: "destructive",
      });
      return;
    }

    initiateMutation.mutate(amount);
  };

  const calculateInstallments = () => {
    const regFee = parseFloat(registrationFee) || 0;
    const remaining = totalFee - regFee;
    const inst1 = regFee;
    const inst2 = Math.floor((remaining / 2) * 100) / 100;
    const inst3 = remaining - inst2;
    
    return { inst1, inst2, inst3 };
  };

  const { inst1, inst2, inst3 } = calculateInstallments();

  const totalPaid = parseFloat(application?.totalPaidAmount || "0");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Initiate Payment</DialogTitle>
          <DialogDescription>
            Set the registration fee amount and send payment link to the applicant.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Already Paid Warning */}
          {totalPaid > 0 && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <strong>User has already paid ₹{totalPaid.toLocaleString()}</strong>
                <br />
                Proceeding will create a new payment plan.
              </AlertDescription>
            </Alert>
          )}

          {/* Total Fee Display (Read-only) */}
          <div className="space-y-2">
            <Label>Total Course Fee (₹)</Label>
            <div className="px-3 py-2 bg-muted rounded-md text-sm font-medium">
              ₹{totalFee.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">
              This is the total fee amount set based on the application type.
            </p>
          </div>

          {/* Registration Fee Input */}
          <div className="space-y-2">
            <Label htmlFor="registrationFee">Registration Fee (₹)</Label>
            <Input
              id="registrationFee"
              type="number"
              min="1"
              max="400000"
              value={registrationFee}
              onChange={(e) => setRegistrationFee(e.target.value)}
              placeholder="10000"
            />
            <p className="text-sm text-muted-foreground">
              This will be the first installment. Must be less than total fee.
            </p>
          </div>

          {/* Installment Preview */}
          <div className="bg-muted/50 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-3">
              <Info className="w-4 h-4 text-blue-500" />
              <h4 className="font-semibold text-sm">Payment Plan Preview</h4>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span>Registration Fee (Due: Immediately)</span>
                <span className="font-medium">₹{inst1.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span>Installment 1 (Due: +30 days)</span>
                <span className="font-medium">₹{inst2.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span>Installment 2 (Due: +60 days)</span>
                <span className="font-medium">₹{inst3.toFixed(2)}</span>
              </div>
              <div className="border-t pt-2 flex justify-between font-bold">
                <span>Total</span>
                <span>₹{totalFee.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Expiry Info */}
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              The payment offer will expire in <strong>24 hours</strong> after sending the email.
            </AlertDescription>
          </Alert>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={initiateMutation.isPending}
          >
            {initiateMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Sending...
              </>
            ) : (
              <>📧 Send Payment Email</>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
