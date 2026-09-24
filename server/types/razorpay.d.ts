declare module "razorpay" {
  interface RazorpayOptions {
    key_id: string;
    key_secret: string;
  }

  interface OrderCreateParams {
    amount: number;
    currency: string;
    receipt?: string;
    notes?: Record<string, string>;
    [key: string]: any;
  }

  interface RazorpayOrder {
    id: string;
    entity: string;
    amount: number;
    amount_paid: number;
    amount_due: number;
    currency: string;
    receipt: string;
    status: string;
    [key: string]: any;
  }

  interface RazorpayPayment {
    id: string;
    entity: string;
    amount: number;
    currency: string;
    status: string;
    method: string;
    [key: string]: any;
  }

  class Razorpay {
    constructor(options: RazorpayOptions);
    orders: {
      create(params: OrderCreateParams): Promise<RazorpayOrder>;
      fetch(orderId: string): Promise<RazorpayOrder>;
      all(params?: Record<string, any>): Promise<{ items: RazorpayOrder[] }>;
    };
    payments: {
      fetch(paymentId: string): Promise<RazorpayPayment>;
      all(params?: Record<string, any>): Promise<{ items: RazorpayPayment[] }>;
    };
  }

  export default Razorpay;
}


