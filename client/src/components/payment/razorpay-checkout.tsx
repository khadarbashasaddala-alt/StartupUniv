/**
 * ============================================
 * 📌 PINNED RAZORPAY TEMPLATE
 * ============================================
 * This is a pinned template for Razorpay payment integration.
 * DO NOT EDIT - This serves as a reference implementation.
 * ============================================
 */

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface RazorpayCheckoutProps {
  installmentId: string;
  applicationId: string;
  amount?: number;
  installmentNumber?: number;
  onSuccess: () => void;
  onFailure?: (error: string) => void;
  onClose?: () => void;
}

declare global {
  interface Window {
    Razorpay: any;
  }
}

export function RazorpayCheckout({
  installmentId,
  applicationId,
  amount,
  installmentNumber,
  onSuccess,
  onFailure,
  onClose,
}: RazorpayCheckoutProps) {
  const [loading, setLoading] = useState(false);
  const [razorpayLoaded, setRazorpayLoaded] = useState(false);
  const { toast } = useToast();

  // Check if Razorpay is loaded
  useEffect(() => {
    const checkRazorpayLoaded = () => {
      if (window.Razorpay && typeof window.Razorpay === 'function') {
        console.log("✅ Razorpay SDK loaded successfully");
        setRazorpayLoaded(true);
        return true;
      }
      return false;
    };

    // Check immediately
    if (checkRazorpayLoaded()) return;

    // If not loaded, wait and retry
    const interval = setInterval(() => {
      if (checkRazorpayLoaded()) {
        clearInterval(interval);
      }
    }, 100);

    // Timeout after 10 seconds
    const timeout = setTimeout(() => {
      clearInterval(interval);
      if (!razorpayLoaded) {
        console.error("❌ Razorpay SDK failed to load");
        toast({
          title: "Payment System Error",
          description: "Payment system failed to load. Please refresh the page.",
          variant: "destructive",
        });
      }
    }, 10000);

    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [razorpayLoaded, toast]);

  const handlePayment = async () => {
    try {
      setLoading(true);

      // Check if Razorpay is loaded
      console.log("🔍 Checking Razorpay:", typeof window.Razorpay);
      if (!window.Razorpay || typeof window.Razorpay !== 'function') {
        throw new Error("Razorpay SDK not loaded properly. Please refresh the page and try again.");
      }

      console.log("📝 Creating payment order for installment:", installmentId);
      // Create order
      const orderResponse = await fetch(
        `/api/applications/${applicationId}/installments/${installmentId}/payment-order`
      );

      if (!orderResponse.ok) {
        const error = await orderResponse.json();
        console.error("❌ Failed to create order:", error);
        throw new Error(error.message || "Failed to create payment order");
      }

      const orderData = await orderResponse.json();

      // Initialize Razorpay
      const options = {
        key: orderData.keyId,
        amount: orderData.amount,
        currency: orderData.currency,
        name: "StartupUniv",
        description: orderData.description,
        order_id: orderData.orderId,
        handler: async function (response: any) {
          try {
            // Verify payment
            const verifyResponse = await fetch(
              `/api/applications/${applicationId}/installments/${installmentId}/verify-payment`,
              {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  razorpay_order_id: response.razorpay_order_id,
                  razorpay_payment_id: response.razorpay_payment_id,
                  razorpay_signature: response.razorpay_signature,
                }),
              }
            );

            if (!verifyResponse.ok) {
              throw new Error("Payment verification failed");
            }

            const result = await verifyResponse.json();

            toast({
              title: "Payment Successful!",
              description: `Payment completed successfully.`,
            });

            onSuccess();
          } catch (error: any) {
            toast({
              title: "Payment Verification Failed",
              description: error.message,
              variant: "destructive",
            });
            onFailure?.(error.message);
          } finally {
            setLoading(false);
          }
        },
        prefill: {
          name: "",
          email: "",
        },
        theme: {
          color: "#667eea",
        },
        modal: {
          ondismiss: function () {
            setLoading(false);
            onClose?.();
            toast({
              title: "Payment Cancelled",
              description: "You cancelled the payment process.",
              variant: "default",
            });
          },
        },
      };

      const razorpay = new window.Razorpay(options);
      razorpay.open();
    } catch (error: any) {
      setLoading(false);
      toast({
        title: "Payment Failed",
        description: error.message || "Unable to initiate payment",
        variant: "destructive",
      });
      onFailure?.(error.message);
    }
  };

  return (
    <Button 
      onClick={handlePayment} 
      disabled={loading || !razorpayLoaded} 
      className="w-full" 
      size="lg"
    >
      {loading ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Processing...
        </>
      ) : !razorpayLoaded ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Loading Payment System...
        </>
      ) : (
        <>💳 Pay Now</>
      )}
    </Button>
  );
}
