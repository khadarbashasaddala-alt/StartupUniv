import Razorpay from "razorpay";
import crypto from "crypto";
import { db } from "../db";
import { storage } from "../storage";
import { applications, paymentInstallments } from "../../shared/schema";
import { eq, and } from "drizzle-orm";
import PDFDocument from "pdfkit";
import { S3StorageService } from "../s3Storage";

const s3StorageService = new S3StorageService();
import { PutObjectCommand } from "@aws-sdk/client-s3";

// Initialize Razorpay
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID || "",
  key_secret: process.env.RAZORPAY_KEY_SECRET || "",
});

interface InstallmentPlan {
  installmentNumber: number;
  installmentType: string;
  amount: number;
  dueDate: Date;
}

/**
 * Create installment plan with registration fee as first installment
 */
/**
 * Calculate installment plan structure (without creating DB records)
 * Returns: 1 registration fee + 2 installments
 */
export function calculateInstallmentPlan(
  totalFee: number,
  registrationFee: number
): InstallmentPlan[] {
  // Validate inputs
  if (registrationFee <= 0) {
    throw new Error("Registration fee must be greater than 0");
  }

  if (registrationFee >= totalFee) {
    throw new Error("Registration fee must be less than total fee");
  }

  const installment1 = registrationFee;
  const remaining = totalFee - registrationFee;
  const installment2 = Math.floor((remaining / 2) * 100) / 100;
  const installment3 = remaining - installment2;

  const now = new Date();
  return [
    {
      installmentNumber: 1,
      installmentType: "REGISTRATION_FEE", // Changed from INSTALLMENT_1
      amount: installment1,
      dueDate: now, // Immediate
    },
    {
      installmentNumber: 2,
      installmentType: "INSTALLMENT_1", // Changed from INSTALLMENT_2
      amount: installment2,
      dueDate: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000), // +30 days
    },
    {
      installmentNumber: 3,
      installmentType: "INSTALLMENT_2", // Changed from INSTALLMENT_3
      amount: installment3,
      dueDate: new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000), // +60 days
    },
  ];
}

/**
 * Create all installments upfront (legacy function - kept for backward compatibility)
 */
export async function createInstallmentPlan(
  applicationId: string,
  totalFee: number,
  registrationFee: number
): Promise<InstallmentPlan[]> {
  // Check if installments already exist for this application
  const existingInstallments = await db
    .select()
    .from(paymentInstallments)
    .where(eq(paymentInstallments.applicationId, applicationId));

  if (existingInstallments.length > 0) {
    console.log(`ℹ️  Installments already exist for application ${applicationId}, returning existing plan`);
    return existingInstallments.map((inst) => ({
      installmentNumber: inst.installmentNumber,
      installmentType: inst.installmentType,
      amount: parseFloat(inst.amount),
      dueDate: inst.dueDate || new Date(),
    }));
  }

  const plan = calculateInstallmentPlan(totalFee, registrationFee);

  // Insert installments into database
  for (const installment of plan) {
    await db.insert(paymentInstallments).values({
      applicationId,
      installmentNumber: installment.installmentNumber,
      installmentType: installment.installmentType,
      amount: installment.amount.toString(),
      dueDate: installment.dueDate,
      status: "PENDING",
    });
  }

  console.log(`✅ Created ${plan.length} installments for application ${applicationId}`);
  return plan;
}

/**
 * Create a single installment on-demand
 */
export async function createSingleInstallment(
  applicationId: string,
  installmentNumber: number,
  totalFee: number,
  registrationFee: number
): Promise<string> {
  // Check if installment already exists
  const [existing] = await db
    .select()
    .from(paymentInstallments)
    .where(
      and(
        eq(paymentInstallments.applicationId, applicationId),
        eq(paymentInstallments.installmentNumber, installmentNumber)
      )
    )
    .limit(1);

  if (existing) {
    console.log(`ℹ️  Installment ${installmentNumber} already exists for application ${applicationId}`);
    return existing.id;
  }

  // Calculate plan to get the installment details
  const plan = calculateInstallmentPlan(totalFee, registrationFee);
  const installment = plan.find((p) => p.installmentNumber === installmentNumber);

  if (!installment) {
    throw new Error(`Invalid installment number: ${installmentNumber}`);
  }

  // Create the installment in database
  const [created] = await db
    .insert(paymentInstallments)
    .values({
      applicationId,
      installmentNumber: installment.installmentNumber,
      installmentType: installment.installmentType,
      amount: installment.amount.toString(),
      dueDate: installment.dueDate,
      status: "PENDING",
    })
    .returning();

  console.log(`✅ Created installment ${installmentNumber} on-demand for application ${applicationId}`);
  return created.id;
}

/**
 * Create Razorpay order for a specific installment
 */
export async function createPaymentOrder(installmentId: string) {
  // Get installment details
  const [installment] = await db
    .select()
    .from(paymentInstallments)
    .where(eq(paymentInstallments.id, installmentId))
    .limit(1);

  if (!installment) {
    throw new Error("Installment not found");
  }

  const [application] = await db
    .select()
    .from(applications)
    .where(eq(applications.id, installment.applicationId))
    .limit(1);

  if (installment.status === "PAID") {
    throw new Error("Installment already paid");
  }

  // Check offer expiry (24 hours from offerSentAt)
  if (application?.offerExpiresAt) {
    const now = new Date();
    if (now > application.offerExpiresAt) {
      throw new Error("Payment offer has expired. Please contact admin.");
    }
  }

  // Create Razorpay order
  const amountInPaise = Math.round(parseFloat(installment.amount) * 100);
  // Razorpay receipt must be max 40 characters - use last 32 chars of UUID
  const shortReceiptId = installment.id.slice(-32);
  const order = await razorpay.orders.create({
    amount: amountInPaise,
    currency: "INR",
    receipt: `inst_${shortReceiptId}`,
    notes: {
      applicationId: installment.applicationId,
      installmentId: installment.id,
      installmentNumber: installment.installmentNumber.toString(),
    },
  });

  // Update installment with order ID
  await db
    .update(paymentInstallments)
    .set({ razorpayOrderId: order.id })
    .where(eq(paymentInstallments.id, installmentId));

  return {
    orderId: order.id,
    amount: amountInPaise,
    currency: "INR",
    keyId: process.env.RAZORPAY_KEY_ID,
    applicationId: installment.applicationId,
    installmentId: installment.id,
    installmentNumber: installment.installmentNumber,
    description: `StartupUniv - Installment ${installment.installmentNumber}`,
  };
}

/**
 * Verify Razorpay payment signature
 */
export function verifyPaymentSignature(
  orderId: string,
  paymentId: string,
  signature: string
): boolean {
  const expectedSignature = crypto
    .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET || "")
    .update(`${orderId}|${paymentId}`)
    .digest("hex");

  return expectedSignature === signature;
}

/**
 * Process successful payment
 */
export async function processPaymentSuccess(
  installmentId: string,
  paymentId: string,
  orderId: string,
  signature: string
) {
  // Verify signature first
  const isValid = verifyPaymentSignature(orderId, paymentId, signature);
  if (!isValid) {
    throw new Error("Invalid payment signature");
  }

  // Get installment with application
  const [installment] = await db
    .select()
    .from(paymentInstallments)
    .where(eq(paymentInstallments.id, installmentId))
    .limit(1);

  if (!installment) {
    throw new Error("Installment not found");
  }

  const [application] = await db
    .select()
    .from(applications)
    .where(eq(applications.id, installment.applicationId))
    .limit(1);

  if (installment.status === "PAID") {
    throw new Error("Installment already marked as paid");
  }

  // Update installment as PAID
  await db
    .update(paymentInstallments)
    .set({
      status: "PAID",
      paidAt: new Date(),
      razorpayPaymentId: paymentId,
    })
    .where(eq(paymentInstallments.id, installmentId));

  // Get all installments for this application
  const allInstallments = await db
    .select()
    .from(paymentInstallments)
    .where(eq(paymentInstallments.applicationId, installment.applicationId));

  // Calculate total paid amount
  const totalPaid = allInstallments
    .filter((i: any) => i.status === "PAID")
    .reduce((sum: number, i: any) => sum + parseFloat(i.amount as string), 0);

  const allPaid = allInstallments.every((i: any) => i.status === "PAID");
  const somePaid = allInstallments.some((i: any) => i.status === "PAID");

  // Update application status and total paid amount
  const newStatus = allPaid ? "PAID" : somePaid ? "PARTIALLY_PAID" : "OFFER";

  await db
    .update(applications)
    .set({
      totalPaidAmount: totalPaid.toString(),
      status: newStatus,
      paid: allPaid,
      razorpayPaymentId: paymentId,
      paymentAttempts: 0, // Reset attempts on success
    })
    .where(eq(applications.id, installment.applicationId));

  // Generate invoice
  const invoiceUrl = await generateInvoice(installmentId);

  // Send success email
  let recipientEmail: string | null = null;
  let recipientName = "Student";

  if (application?.userId) {
    const user = await storage.getUser(application.userId);

    if (user?.email) {
      recipientEmail = user.email;
      recipientName = user.name || "Student";
    }
  }

  // Fallback: get email from formJson if no userId or user email
  if (!recipientEmail && application) {
    const formData = (application.formJson as any) || {};
    recipientEmail = formData.email || formData.personalEmail || formData.contactEmail || null;
    recipientName = formData.fullName || formData.name || "Student";
  }

  if (recipientEmail) {
    await sendPaymentSuccessEmail(
      recipientEmail,
      recipientName,
      parseFloat(installment.amount),
      installment.installmentNumber,
      installment.installmentType,
      paymentId,
      invoiceUrl,
      allInstallments.filter((i: any) => i.status === "PENDING")[0] || null
    );
  }

  // Create notification for admins about payment received
  try {
    const adminUsers = await storage.getUsersByRole("ADMIN");
    const formData = (application?.formJson as any) || {};
    const applicantName = formData?.fullName || formData?.name || "Candidate";
    const paymentAmount = parseFloat(installment.amount);
    const paymentStatus = allPaid ? "fully paid" : somePaid ? "partially paid" : "payment received";

    for (const admin of adminUsers) {
      try {
        await storage.createNotification({
          userId: admin.id,
          type: "CANDIDATE_SELECTED" as any, // Using existing notification type
          title: `Payment Received - ${applicantName}`,
          message: `${applicantName} has ${paymentStatus} ₹${paymentAmount.toFixed(2)} (Installment ${installment.installmentNumber}). ${allPaid ? "All installments completed." : somePaid ? "Remaining installments pending." : ""}`,
          metadataJson: {
            applicationId: installment.applicationId,
            installmentId: installment.id,
            installmentNumber: installment.installmentNumber,
            paymentId: paymentId,
            amount: paymentAmount,
            allPaid: allPaid,
            totalPaid: totalPaid,
            applicantName: applicantName,
          },
        });
      } catch (notifError: any) {
        console.error(`Failed to create payment notification for admin ${admin.id}:`, notifError);
        // Continue with other admins even if one fails
      }
    }
    console.log(`✅ Created payment notifications for ${adminUsers.length} admin(s)`);
  } catch (notificationError: any) {
    console.error("⚠️ Failed to create admin notifications for payment (non-fatal):", notificationError);
    // Don't fail the payment processing if notification fails
  }

  return {
    installment,
    application: application,
    invoiceUrl,
    allPaid,
    totalPaid,
    newStatus,
  };
}

/**
 * Process failed payment
 */
export async function processPaymentFailure(
  installmentId: string,
  reason: string
) {
  const [installment] = await db
    .select()
    .from(paymentInstallments)
    .where(eq(paymentInstallments.id, installmentId))
    .limit(1);

  if (!installment) {
    throw new Error("Installment not found");
  }

  const [application] = await db
    .select()
    .from(applications)
    .where(eq(applications.id, installment.applicationId))
    .limit(1);

  if (!application) {
    throw new Error("Application not found");
  }

  // Increment payment attempts
  const newAttempts = (application.paymentAttempts || 0) + 1;

  await db
    .update(applications)
    .set({
      paymentAttempts: newAttempts,
      lastPaymentAttemptAt: new Date(),
    })
    .where(eq(applications.id, installment.applicationId));

  // Update installment status
  await db
    .update(paymentInstallments)
    .set({ status: "FAILED" })
    .where(eq(paymentInstallments.id, installmentId));

  return {
    installment,
    attempts: newAttempts,
  };
}

/**
 * Check if user can retry payment (considering cooldown)
 */
export async function canRetryPayment(applicationId: string) {
  const [application] = await db
    .select()
    .from(applications)
    .where(eq(applications.id, applicationId))
    .limit(1);

  if (!application) {
    return { canRetry: false, reason: "Application not found" };
  }

  const attempts = application.paymentAttempts || 0;
  const retryLimit = parseInt(process.env.PAYMENT_RETRY_LIMIT || "2");
  const cooldownSeconds = parseInt(process.env.PAYMENT_RETRY_COOLDOWN || "3600");

  // If attempts < limit, can retry
  if (attempts < retryLimit) {
    return { canRetry: true, attemptsLeft: retryLimit - attempts };
  }

  // If attempts >= limit, check cooldown
  if (application.lastPaymentAttemptAt) {
    const now = new Date();
    const lastAttempt = new Date(application.lastPaymentAttemptAt);
    const timeSinceLastAttempt = (now.getTime() - lastAttempt.getTime()) / 1000;

    if (timeSinceLastAttempt >= cooldownSeconds) {
      // Reset attempts after cooldown
      await db
        .update(applications)
        .set({ paymentAttempts: 0 })
        .where(eq(applications.id, applicationId));

      return { canRetry: true, attemptsLeft: retryLimit, cooldownExpired: true };
    } else {
      const remainingCooldown = cooldownSeconds - Math.floor(timeSinceLastAttempt);
      return {
        canRetry: false,
        reason: "Too many failed attempts",
        cooldownRemaining: remainingCooldown,
        cooldownEndsAt: new Date(lastAttempt.getTime() + cooldownSeconds * 1000),
      };
    }
  }

  return { canRetry: true, attemptsLeft: retryLimit };
}

/**
 * Check if offer has expired
 */
export async function checkOfferExpiry(applicationId: string) {
  const [application] = await db
    .select()
    .from(applications)
    .where(eq(applications.id, applicationId))
    .limit(1);

  if (!application || !application.offerExpiresAt) {
    return false;
  }

  const now = new Date();
  return now > application.offerExpiresAt;
}

/**
 * Generate PDF invoice for installment
 */
export async function generateInvoice(installmentId: string): Promise<string> {
  const [installment] = await db
    .select()
    .from(paymentInstallments)
    .where(eq(paymentInstallments.id, installmentId))
    .limit(1);

  if (!installment) {
    throw new Error("Installment not found");
  }

  const [application] = await db
    .select()
    .from(applications)
    .where(eq(applications.id, installment.applicationId))
    .limit(1);

  if (!application) {
    throw new Error("Application not found");
  }

  // Get user details for invoice (may be null for public applications)
  const user = application.userId ? await storage.getUser(application.userId) : null;

  // Fallback to formJson for customer details
  const invoiceFormData = (application.formJson as any) || {};

  const amount = parseFloat(installment.amount);
  const gstRate = parseFloat(process.env.GST_RATE || "18");
  const gstInclusive = process.env.GST_INCLUSIVE === "true";

  let baseAmount: number;
  let gstAmount: number;
  let totalAmount: number;

  if (gstInclusive) {
    totalAmount = amount;
    baseAmount = amount / (1 + gstRate / 100);
    gstAmount = amount - baseAmount;
  } else {
    baseAmount = amount;
    gstAmount = (amount * gstRate) / 100;
    totalAmount = amount + gstAmount;
  }

  // Create PDF
  const doc = new PDFDocument({ size: "A4", margin: 50 });
  const buffers: Buffer[] = [];

  doc.on("data", buffers.push.bind(buffers));

  // Header
  doc.fontSize(20).text(process.env.COMPANY_NAME || "StartupUniv", { align: "center" });
  doc.fontSize(10).text(process.env.COMPANY_ADDRESS || "", { align: "center" });
  doc.text(`Email: ${process.env.COMPANY_EMAIL || ""}`, { align: "center" });
  doc.text(`GST: ${process.env.COMPANY_GST_NUMBER || ""}`, { align: "center" });
  doc.moveDown(2);

  // Title
  doc.fontSize(16).text("PAYMENT INVOICE", { align: "center", underline: true });
  doc.moveDown(2);

  // Invoice details
  doc.fontSize(10);
  doc.text(`Invoice Number: INV-${installment.id.substring(0, 8).toUpperCase()}`);
  doc.text(`Date: ${new Date().toLocaleDateString()}`);
  doc.text(`Transaction ID: ${installment.razorpayPaymentId || "N/A"}`);
  doc.moveDown();

  // Customer details
  doc.text("Bill To:");
  doc.text(`Name: ${user?.name || invoiceFormData.fullName || invoiceFormData.name || "N/A"}`);
  doc.text(`Email: ${user?.email || invoiceFormData.email || "N/A"}`);
  doc.moveDown(2);

  // Table
  const tableTop = doc.y;
  doc.text("Description", 50, tableTop);
  doc.text("Amount", 400, tableTop, { width: 90, align: "right" });
  doc.moveDown();

  const lineY = doc.y;
  doc.moveTo(50, lineY).lineTo(550, lineY).stroke();
  doc.moveDown(0.5);

  // Determine label based on installment type or number
  let installmentLabel = "";
  if (installment.installmentType === "REGISTRATION_FEE" || installment.installmentNumber === 1) {
    installmentLabel = "Registration Fee";
  } else if (installment.installmentType === "INSTALLMENT_1" || installment.installmentNumber === 2) {
    installmentLabel = "Installment 1";
  } else if (installment.installmentType === "INSTALLMENT_2" || installment.installmentNumber === 3) {
    installmentLabel = "Installment 2";
  } else {
    installmentLabel = `Installment ${installment.installmentNumber}`;
  }
  
  doc.text(`${installmentLabel} - StartupUniv Program`, 50, doc.y);
  doc.text(`₹${baseAmount.toFixed(2)}`, 400, doc.y - 10, { width: 90, align: "right" });
  doc.moveDown();

  doc.text(`GST (${gstRate}%)`, 50, doc.y);
  doc.text(`₹${gstAmount.toFixed(2)}`, 400, doc.y - 10, { width: 90, align: "right" });
  doc.moveDown();

  const totalLineY = doc.y;
  doc.moveTo(50, totalLineY).lineTo(550, totalLineY).stroke();
  doc.moveDown(0.5);

  doc.fontSize(12).text("Total Amount", 50, doc.y);
  doc.text(`₹${totalAmount.toFixed(2)}`, 400, doc.y - 12, { width: 90, align: "right" });
  doc.moveDown(2);

  // Footer
  doc.fontSize(10).text("Thank you for your payment!", { align: "center" });
  doc.text("For any queries, contact us at hello@startupvarsity.com", { align: "center" });

  doc.end();

  // Wait for PDF generation to complete
  const pdfBuffer = await new Promise<Buffer>((resolve) => {
    doc.on("end", () => {
      resolve(Buffer.concat(buffers));
    });
  });

  // Upload to S3
  const fileName = `invoices/${installment.applicationId}/${installment.id}.pdf`;
  
  // Upload using S3 client directly
  const s3Client = (s3StorageService as any).s3Client;
  const bucketName = (s3StorageService as any).bucketName;
  
  const uploadCommand = new PutObjectCommand({
    Bucket: bucketName,
    Key: fileName,
    Body: pdfBuffer,
    ContentType: "application/pdf",
  });
  
  await s3Client.send(uploadCommand);
  
  const s3Url = `https://${bucketName}.s3.amazonaws.com/${fileName}`;
  return s3Url;
}

/**
 * Handle Razorpay webhook
 */
export async function handleWebhook(payload: any, signature: string) {
  // Verify webhook signature
  const expectedSignature = crypto
    .createHmac("sha256", process.env.RAZORPAY_WEBHOOK_SECRET || "")
    .update(JSON.stringify(payload))
    .digest("hex");

  if (expectedSignature !== signature) {
    throw new Error("Invalid webhook signature");
  }

  const event = payload.event;
  const paymentData = payload.payload?.payment?.entity;

  switch (event) {
    case "payment.captured":
      if (paymentData && paymentData.notes?.installmentId) {
        await processPaymentSuccess(
          paymentData.notes.installmentId,
          paymentData.id,
          paymentData.order_id,
          "" // Signature already verified
        );
      }
      break;

    case "payment.failed":
      if (paymentData && paymentData.notes?.installmentId) {
        await processPaymentFailure(
          paymentData.notes.installmentId,
          paymentData.error_description || "Payment failed"
        );
      }
      break;

    case "order.paid":
      // Additional handling if needed
      break;
  }

  return { status: "ok" };
}

/**
 * Send payment success email
 */
async function sendPaymentSuccessEmail(
  email: string,
  name: string,
  amount: number,
  installmentNumber: number,
  installmentType: string,
  transactionId: string,
  invoiceUrl: string,
  nextInstallment: any
) {
  // Determine label based on installment type or number
  let installmentLabel = "";
  if (installmentType === "REGISTRATION_FEE" || installmentNumber === 1) {
    installmentLabel = "Registration Fee";
  } else if (installmentType === "INSTALLMENT_1" || installmentNumber === 2) {
    installmentLabel = "Installment 1";
  } else if (installmentType === "INSTALLMENT_2" || installmentNumber === 3) {
    installmentLabel = "Installment 2";
  } else {
    installmentLabel = `Installment ${installmentNumber}`;
  }
  
  const subject = `✅ Payment Confirmed - ${installmentLabel}`;
  
  let nextInstallmentText = "";
  if (nextInstallment) {
    const dueDate = new Date(nextInstallment.dueDate).toLocaleDateString();
    nextInstallmentText = `
      <h3>Next Installment</h3>
      <p>Amount: ₹${parseFloat(nextInstallment.amount).toFixed(2)}</p>
      <p>Due Date: ${dueDate}</p>
    `;
  } else {
    nextInstallmentText = `
      <h3>🎉 All Installments Completed!</h3>
      <p>You have successfully completed all payments.</p>
    `;
  }

  const html = `
    <h2>Payment Successful!</h2>
    <p>Dear ${name},</p>
    <p>Your payment of ₹${amount.toFixed(2)} has been successfully received.</p>
    
    <h3>Payment Details</h3>
    <ul>
      <li>Amount: ₹${amount.toFixed(2)}</li>
      <li>Payment: ${installmentLabel}</li>
      <li>Transaction ID: ${transactionId}</li>
      <li>Date: ${new Date().toLocaleDateString()}</li>
    </ul>
    
    <p><a href="${invoiceUrl}" style="background-color: #4CAF50; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Download Invoice</a></p>
    
    ${nextInstallmentText}
    
    <p>Thank you!</p>
    <p>StartupUniv Team</p>
  `;

  // Send email using sendgrid
  const sgMail = (await import("@sendgrid/mail")).default;
  const apiKey = process.env.SENDGRID_API_KEY || process.env.EMAIL_HOST_PASSWORD;
  if (apiKey) {
    sgMail.setApiKey(apiKey);
    const EMAIL_FROM = process.env.EMAIL_FROM || process.env.DEFAULT_FROM_EMAIL || "noreply@startupvarsity.com";
    await sgMail.send({
      to: email,
      from: EMAIL_FROM,
      subject,
      html,
    });
  }
}
