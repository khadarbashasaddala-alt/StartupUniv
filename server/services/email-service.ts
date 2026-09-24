// @ts-ignore - Optional dependency
import sgMail from "@sendgrid/mail";

// Support both SENDGRID_API_KEY and EMAIL_HOST_PASSWORD (Django-style). Trim so trailing newlines from secrets don't break SendGrid.
function getSendGridKey(): string {
  return (process.env.SENDGRID_API_KEY || process.env.EMAIL_HOST_PASSWORD || "").trim();
}
const sendGridApiKey = getSendGridKey();

if (!sendGridApiKey) {
  console.warn("⚠️  SENDGRID_API_KEY or EMAIL_HOST_PASSWORD not set. Email functionality will be disabled.");
} else {
  sgMail.setApiKey(sendGridApiKey);
}

const EMAIL_FROM = process.env.EMAIL_FROM || process.env.DEFAULT_FROM_EMAIL || "noreply@startupvarsity.com";
const PORTAL_URL = process.env.PORTAL_URL || "http://localhost:5000";
// Payment links use rooman.net subdomain for Razorpay domain whitelist; all other links use PORTAL_URL (startupvarsity.com)
const PAYMENT_PORTAL_URL = process.env.PAYMENT_PORTAL_URL || PORTAL_URL;

interface Credentials {
  email: string;
  password: string;
}

interface MeetingDetails {
  date: string;
  time: string;
  meetingLink: string;
  agenda: string;
  candidateName: string;
}

/**
 * Send acceptance email with login credentials
 */
export async function sendAcceptanceEmail(
  to: string,
  name: string,
  credentials: Credentials,
  portalLink: string = PORTAL_URL
): Promise<void> {
  const sendGridApiKey = getSendGridKey();
  if (!sendGridApiKey) {
    throw new Error("SENDGRID_API_KEY or EMAIL_HOST_PASSWORD not configured");
  }

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
        .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
        .credentials { background: white; padding: 20px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #667eea; }
        .button { display: inline-block; padding: 12px 30px; background: #667eea; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
        .footer { text-align: center; margin-top: 30px; color: #666; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🎉 Welcome to StartupUniv!</h1>
        </div>
        <div class="content">
          <p>Dear ${name},</p>
          
          <p>Congratulations! We are thrilled to inform you that your application has been accepted. Welcome to the StartupUniv family!</p>
          
          <div class="credentials">
            <h3>Your Portal Access Credentials:</h3>
            <p><strong>Email:</strong> ${credentials.email}</p>
            <p><strong>Password:</strong> ${credentials.password}</p>
            <p style="color: #d32f2f; font-size: 12px; margin-top: 10px;">
              ⚠️ Please change your password after your first login for security.
            </p>
          </div>
          
          <p>You can now access your dashboard and start your entrepreneurial journey with us.</p>
          
          <div style="text-align: center;">
            <a href="${portalLink}/app/login" class="button">Access Portal</a>
          </div>
          
          <p>If you have any questions or need assistance, please don't hesitate to reach out to our support team.</p>
          
          <p>Best regards,<br>The StartupUniv Team</p>
        </div>
        <div class="footer">
          <p>This is an automated email. Please do not reply to this message.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  const msg = {
    to,
    from: EMAIL_FROM,
    subject: "Welcome to StartupUniv - Your Account Credentials",
    html,
  };

  try {
    await sgMail.send(msg);
    console.log(`✅ Acceptance email sent to ${to}`);
  } catch (error) {
    console.error("❌ Error sending acceptance email:", error);
    throw error;
  }
}

/**
 * Send email with updated credentials
 */
export async function sendUpdatedCredentialsEmail(
  to: string,
  newPassword: string,
  portalLink: string = PORTAL_URL
): Promise<void> {
  const sendGridApiKey = getSendGridKey();
  if (!sendGridApiKey) {
    throw new Error("SENDGRID_API_KEY or EMAIL_HOST_PASSWORD not configured");
  }

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #dc2626 0%, #991b1b 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
        .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
        .credentials { background: white; padding: 20px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #dc2626; }
        .button { display: inline-block; padding: 12px 30px; background: #dc2626; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
        .footer { text-align: center; margin-top: 30px; color: #666; font-size: 12px; }
        .warning { background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0; border-radius: 5px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🔐 Password Updated</h1>
        </div>
        <div class="content">
          <p>Hello,</p>
          
          <p>Your StartupUniv account password has been updated by an administrator.</p>
          
          <div class="credentials">
            <h3>Your Updated Login Credentials:</h3>
            <p><strong>Email:</strong> ${to}</p>
            <p><strong>New Password:</strong> ${newPassword}</p>
          </div>
          
          <div class="warning">
            <p style="margin: 0; color: #92400e;">
              ⚠️ <strong>Security Reminder:</strong> Please change your password after your next login for security purposes.
            </p>
          </div>
          
          <p>You can access your dashboard using the updated credentials.</p>
          
          <div style="text-align: center;">
            <a href="${portalLink}/app/login" class="button">Access Portal</a>
          </div>
          
          <p>If you did not request this change or have any concerns, please contact our support team immediately.</p>
          
          <p>Best regards,<br>The StartupUniv Team</p>
        </div>
        <div class="footer">
          <p>This is an automated email. Please do not reply to this message.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  const msg = {
    to,
    from: EMAIL_FROM,
    subject: "StartupUniv - Password Updated",
    html,
  };

  try {
    await sgMail.send(msg);
    console.log(`✅ Updated credentials email sent to ${to}`);
  } catch (error) {
    console.error("❌ Error sending updated credentials email:", error);
    throw error;
  }
}

export async function sendTeamApplicationInviteEmail(params: {
  to: string;
  teamName: string;
  roleLabel: string;
  inviteUrl: string;
}): Promise<void> {
  const sendGridApiKey = getSendGridKey();
  if (!sendGridApiKey) {
    throw new Error("SENDGRID_API_KEY or EMAIL_HOST_PASSWORD not configured");
  }

  const { to, teamName, roleLabel, inviteUrl } = params;

  const normalizeUrl = (raw: string) => {
    const trimmed = (raw || "").trim();
    if (!trimmed) return trimmed;
    if (/^https?:\/\//i.test(trimmed)) return trimmed;
    // Common misconfig: PORTAL_URL set as "localhost:5432" (no protocol)
    if (/^(localhost|127\.0\.0\.1)(:\d+)?(\/|$)/i.test(trimmed)) {
      return `http://${trimmed}`;
    }
    return `https://${trimmed}`;
  };

  const inviteUrlSafe = normalizeUrl(inviteUrl);

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #dc2626 0%, #991b1b 100%); color: white; padding: 26px; text-align: center; border-radius: 10px 10px 0 0; }
        .content { background: #f9f9f9; padding: 26px; border-radius: 0 0 10px 10px; }
        .button { display: inline-block; padding: 12px 26px; background: #dc2626; color: white !important; text-decoration: none; border-radius: 6px; margin: 18px 0; }
        .meta { background: white; padding: 14px 16px; border-radius: 8px; border-left: 4px solid #dc2626; margin: 16px 0; }
        .footer { text-align: center; margin-top: 24px; color: #666; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>StartupUniv Team Invitation</h1>
        </div>
        <div class="content">
          <p>You have been invited to complete your application for a team.</p>
          <div class="meta">
            <p style="margin: 0;"><strong>Team:</strong> ${teamName}</p>
            <p style="margin: 6px 0 0 0;"><strong>Role:</strong> ${roleLabel}</p>
          </div>

          <p>Please use the link below to complete your application:</p>
          <div style="text-align:center;">
            <a href="${inviteUrlSafe}" class="button" target="_blank" rel="noopener noreferrer">Complete Application</a>
          </div>

          <p style="margin-top: 8px; font-size: 12px; color: #555;">If the button doesn't work, copy and paste this link into your browser:</p>
          <p style="margin: 6px 0 0 0; word-break: break-all;">
            <a href="${inviteUrlSafe}" target="_blank" rel="noopener noreferrer">${inviteUrlSafe}</a>
          </p>

          <p>If you did not expect this invitation, you can ignore this email.</p>
          <p>Best regards,<br/>The StartupUniv Team</p>
        </div>
        <div class="footer">
          <p>This is an automated email. Please do not reply.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  const msg = {
    to,
    from: EMAIL_FROM,
    subject: `Team Application Invitation - ${teamName}`,
    html,
  };

  await sgMail.send(msg);
  console.log(`✅ Team invite email sent to ${to}`);
}

/**
 * Send meeting invitation email to candidate
 */
export async function sendMeetingInviteToCandidate(
  to: string,
  name: string,
  meetingDetails: MeetingDetails
): Promise<void> {
  const sendGridApiKey = getSendGridKey();
  if (!sendGridApiKey) {
    throw new Error("SENDGRID_API_KEY or EMAIL_HOST_PASSWORD not configured");
  }

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
        .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
        .meeting-details { background: white; padding: 20px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #667eea; }
        .button { display: inline-block; padding: 12px 30px; background: #667eea; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
        .footer { text-align: center; margin-top: 30px; color: #666; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>📅 Interview Scheduled</h1>
        </div>
        <div class="content">
          <p>Dear ${name},</p>
          
          <p>We are pleased to inform you that an interview has been scheduled for your application.</p>
          
          <div class="meeting-details">
            <h3>Meeting Details:</h3>
            <p><strong>Date:</strong> ${meetingDetails.date}</p>
            <p><strong>Time:</strong> ${meetingDetails.time}</p>
            ${meetingDetails.agenda ? `<p><strong>Agenda:</strong><br>${meetingDetails.agenda.replace(/\n/g, '<br>')}</p>` : ''}
          </div>
          
          <p>Please join the meeting using the link below:</p>
          
          <div style="text-align: center;">
            <a href="${meetingDetails.meetingLink}" class="button" target="_blank">Join Meeting</a>
          </div>
          
          <p>We look forward to speaking with you!</p>
          
          <p>Best regards,<br>The StartupUniv Team</p>
        </div>
        <div class="footer">
          <p>This is an automated email. Please do not reply to this message.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  const msg = {
    to,
    from: EMAIL_FROM,
    subject: "Interview Scheduled - StartupUniv",
    html,
  };

  try {
    await sgMail.send(msg);
    console.log(`✅ Meeting invite sent to candidate ${to}`);
  } catch (error) {
    console.error("❌ Error sending meeting invite:", error);
    throw error;
  }
}

/**
 * Send meeting invitation email to admin
 */
export async function sendMeetingInviteToAdmin(
  to: string,
  candidateName: string,
  meetingDetails: MeetingDetails
): Promise<void> {
  const sendGridApiKey = getSendGridKey();
  if (!sendGridApiKey) {
    throw new Error("SENDGRID_API_KEY or EMAIL_HOST_PASSWORD not configured");
  }

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
        .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
        .meeting-details { background: white; padding: 20px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #667eea; }
        .button { display: inline-block; padding: 12px 30px; background: #667eea; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
        .footer { text-align: center; margin-top: 30px; color: #666; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>📅 Interview Scheduled</h1>
        </div>
        <div class="content">
          <p>Hello,</p>
          
          <p>A meeting has been scheduled with <strong>${candidateName}</strong>.</p>
          
          <div class="meeting-details">
            <h3>Meeting Details:</h3>
            <p><strong>Candidate:</strong> ${candidateName}</p>
            <p><strong>Date:</strong> ${meetingDetails.date}</p>
            <p><strong>Time:</strong> ${meetingDetails.time}</p>
            ${meetingDetails.agenda ? `<p><strong>Agenda:</strong><br>${meetingDetails.agenda.replace(/\n/g, '<br>')}</p>` : ''}
          </div>
          
          <p>Join the meeting using the link below:</p>
          
          <div style="text-align: center;">
            <a href="${meetingDetails.meetingLink}" class="button" target="_blank">Join Meeting</a>
          </div>
          
          <p>Best regards,<br>StartupUniv System</p>
        </div>
        <div class="footer">
          <p>This is an automated email. Please do not reply to this message.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  const msg = {
    to,
    from: EMAIL_FROM,
    subject: `Interview Scheduled with ${candidateName} - StartupUniv`,
    html,
  };

  try {
    await sgMail.send(msg);
    console.log(`✅ Meeting invite sent to admin ${to}`);
  } catch (error) {
    console.error("❌ Error sending meeting invite to admin:", error);
    throw error;
  }
}

/**
 * Send assessment assignment email to candidate with public link
 */
export async function sendAssessmentAssignmentEmail(
  to: string,
  name: string,
  assessmentTitle: string,
  assessmentLink: string
): Promise<void> {
  const sendGridApiKey = getSendGridKey();
  if (!sendGridApiKey) {
    throw new Error("SENDGRID_API_KEY or EMAIL_HOST_PASSWORD not configured");
  }

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
        .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
        .assessment-details { background: white; padding: 20px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #667eea; }
        .button { display: inline-block; padding: 12px 30px; background: #667eea; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
        .footer { text-align: center; margin-top: 30px; color: #666; font-size: 12px; }
        .warning { background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; border-radius: 5px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>📝 Assessment Invitation</h1>
        </div>
        <div class="content">
          <p>Dear ${name},</p>
          
          <p>Thank you for your interest in the Intern role at StartupUniv. We have received your application and would like to invite you to complete an assessment as part of our selection process.</p>
          
          <div class="assessment-details">
            <h3>Assessment Details:</h3>
            <p><strong>Assessment:</strong> ${assessmentTitle}</p>
            <p>This assessment will help us better understand your skills and suitability for the position.</p>
          </div>
          
          <div class="warning">
            <p><strong>Important:</strong></p>
            <ul style="margin: 10px 0; padding-left: 20px;">
              <li>You will need to verify your email address to access the assessment</li>
              <li>You have only one attempt to complete this assessment</li>
              <li>Please ensure you have a stable internet connection</li>
              <li>Set aside adequate time to complete the assessment without interruptions</li>
            </ul>
          </div>
          
          <p>Click the button below to begin the assessment:</p>
          
          <div style="text-align: center;">
            <a href="${assessmentLink}" class="button" target="_blank" style="display: inline-block; padding: 12px 30px; background: #667eea; color: white !important; text-decoration: none; border-radius: 5px; margin: 20px 0;">Start Assessment</a>
          </div>
          
          <p style="margin-top: 20px; font-size: 14px; color: #666;">
            Or copy and paste this link into your browser:<br>
            <a href="${assessmentLink}" style="color: #667eea; word-break: break-all;">${assessmentLink}</a>
          </p>
          
          <p>If you have any questions or encounter any issues, please contact our support team.</p>
          
          <p>Best regards,<br>The StartupUniv Team</p>
        </div>
        <div class="footer">
          <p>This is an automated email. Please do not reply to this message.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  const msg = {
    to,
    from: EMAIL_FROM,
    subject: `Assessment Invitation - ${assessmentTitle} - StartupUniv`,
    html,
  };

  try {
    await sgMail.send(msg);
    console.log(`✅ Assessment assignment email sent to ${to}`);
  } catch (error) {
    console.error("❌ Error sending assessment assignment email:", error);
    throw error;
  }
}

/**
 * Send mentor credentials email
 */
export async function sendMentorCredentialsEmail(
  to: string,
  name: string,
  credentials: Credentials
): Promise<void> {
  const sendGridApiKey = getSendGridKey();
  if (!sendGridApiKey) {
    throw new Error("SENDGRID_API_KEY or EMAIL_HOST_PASSWORD not configured");
  }

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
        .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
        .credentials { background: white; padding: 20px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #667eea; }
        .button { display: inline-block; padding: 12px 30px; background: #667eea; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
        .footer { text-align: center; margin-top: 30px; color: #666; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🎓 Welcome as a Mentor!</h1>
        </div>
        <div class="content">
          <p>Dear ${name},</p>
          
          <p>We are delighted to welcome you as a mentor to StartupUniv! Your expertise and guidance will be invaluable to our aspiring entrepreneurs.</p>
          
          <div class="credentials">
            <h3>Your Portal Access Credentials:</h3>
            <p><strong>Email:</strong> ${credentials.email}</p>
            <p><strong>Password:</strong> ${credentials.password}</p>
            <p style="color: #d32f2f; font-size: 12px; margin-top: 10px;">
              ⚠️ Please change your password after your first login for security.
            </p>
          </div>
          
          <p>You can now access your mentor dashboard and start supporting our teams.</p>
          
          <div style="text-align: center;">
            <a href="${PORTAL_URL}/app/login" class="button">Access Portal</a>
          </div>
          
          <p>If you have any questions or need assistance, please don't hesitate to reach out to our support team.</p>
          
          <p>Best regards,<br>The StartupUniv Team</p>
        </div>
        <div class="footer">
          <p>This is an automated email. Please do not reply to this message.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  const msg = {
    to,
    from: EMAIL_FROM,
    subject: "Welcome as a Mentor - Your Account Credentials - StartupUniv",
    html,
  };

  try {
    await sgMail.send(msg);
    console.log(`✅ Mentor credentials email sent to ${to}`);
  } catch (error) {
    console.error("❌ Error sending mentor credentials email:", error);
    throw error;
  }
}

/**
 * Send password reset OTP email
 */
export async function sendPasswordResetOtpEmail(
  to: string,
  otp: string
): Promise<void> {
  const sendGridApiKey = getSendGridKey();
  if (!sendGridApiKey) {
    console.error("❌ SendGrid API key not found!");
    console.error("   Check SENDGRID_API_KEY or EMAIL_HOST_PASSWORD environment variable");
    console.error("   In production, set this in AWS Secrets Manager or ECS task definition");
    throw new Error("SENDGRID_API_KEY or EMAIL_HOST_PASSWORD not configured");
  }
  
  console.log(`📧 Attempting to send OTP email to: ${to}`);
  console.log(`📧 From email: ${EMAIL_FROM}`);
  console.log(`📧 SendGrid API key configured: ${sendGridApiKey ? 'Yes (length: ' + sendGridApiKey.length + ')' : 'No'}`);
  
  // In debug mode, log OTP
  if (process.env.DEBUG_OTP === "true") {
    console.log(`🔧 DEBUG_OTP enabled - OTP: ${otp}`);
  }

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #dc2626 0%, #991b1b 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
        .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
        .otp-box { background: white; padding: 30px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #dc2626; text-align: center; }
        .otp-code { font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #dc2626; font-family: monospace; }
        .warning { background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; border-radius: 5px; }
        .footer { text-align: center; margin-top: 30px; color: #666; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🔐 Password Reset Request</h1>
        </div>
        <div class="content">
          <p>Hello,</p>
          
          <p>We received a request to reset your password for your StartupUniv account.</p>
          
          <div class="otp-box">
            <p style="margin: 0 0 10px 0; color: #666;">Your OTP code is:</p>
            <div class="otp-code">${otp}</div>
            <p style="margin: 10px 0 0 0; color: #666; font-size: 14px;">This code will expire in 10 minutes</p>
          </div>
          
          <div class="warning">
            <p><strong>⚠️ Security Notice:</strong></p>
            <ul style="margin: 10px 0; padding-left: 20px;">
              <li>This OTP is valid for 10 minutes only</li>
              <li>Do not share this code with anyone</li>
              <li>If you didn't request this, please ignore this email</li>
            </ul>
          </div>
          
          <p>If you have any questions or need assistance, please contact our support team.</p>
          
          <p>Best regards,<br>The StartupUniv Team</p>
        </div>
        <div class="footer">
          <p>This is an automated email. Please do not reply to this message.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  const msg = {
    to,
    from: EMAIL_FROM,
    subject: "Password Reset OTP - StartupUniv",
    html,
  };

  try {
    await sgMail.send(msg);
    console.log(`✅ Password reset OTP email sent to ${to}`);
  } catch (error: any) {
    console.error("❌ Error sending password reset OTP email:", error);
    console.error("SendGrid error details:", {
      message: error?.message,
      code: error?.code,
      response: error?.response?.body,
      statusCode: error?.response?.statusCode,
    });
    // Check if it's a SendGrid API key issue
    if (error?.code === 401 || error?.response?.statusCode === 401) {
      console.error("⚠️  SendGrid API key is invalid or missing!");
    }
    throw error;
  }
}

/**
 * Send mentor application confirmation email
 */
export async function sendMentorApplicationConfirmationEmail(
  to: string,
  name: string,
  jobTitle: string
): Promise<void> {
  const sendGridApiKey = getSendGridKey();
  if (!sendGridApiKey) {
    throw new Error("SENDGRID_API_KEY or EMAIL_HOST_PASSWORD not configured");
  }

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #dc2626 0%, #991b1b 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
        .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
        .success-box { background: white; padding: 20px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #dc2626; }
        .footer { text-align: center; margin-top: 30px; color: #666; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>✅ Application Received!</h1>
        </div>
        <div class="content">
          <p>Dear ${name},</p>
          
          <p>Thank you for your interest in becoming a mentor at StartupUniv!</p>
          
          <div class="success-box">
            <h3>Application Details:</h3>
            <p><strong>Position:</strong> ${jobTitle}</p>
            <p><strong>Status:</strong> Under Review</p>
          </div>
          
          <p>We have successfully received your mentor application. Our team will review your application and get back to you within 5-7 business days.</p>
          
          <p>If you have any questions or need to update your application, please don't hesitate to contact us.</p>
          
          <p>Best regards,<br>The StartupUniv Team</p>
        </div>
        <div class="footer">
          <p>This is an automated email. Please do not reply to this message.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  const msg = {
    to,
    from: EMAIL_FROM,
    subject: "Mentor Application Received - StartupUniv",
    html,
  };

  try {
    await sgMail.send(msg);
    console.log(`✅ Mentor application confirmation email sent to ${to}`);
  } catch (error) {
    console.error("❌ Error sending mentor application confirmation email:", error);
    throw error;
  }
}

/**
 * Send notification email to admin about mentor creation
 */
export async function sendMentorCreationNotificationToAdmin(
  to: string,
  mentorName: string,
  mentorEmail: string
): Promise<void> {
  const sendGridApiKey = getSendGridKey();
  if (!sendGridApiKey) {
    throw new Error("SENDGRID_API_KEY or EMAIL_HOST_PASSWORD not configured");
  }

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
        .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
        .info-box { background: white; padding: 20px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #667eea; }
        .button { display: inline-block; padding: 12px 30px; background: #667eea; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
        .footer { text-align: center; margin-top: 30px; color: #666; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>👤 New Mentor Created</h1>
        </div>
        <div class="content">
          <p>Hello,</p>
          
          <p>A new mentor has been created and requires your approval to share credentials.</p>
          
          <div class="info-box">
            <h3>Mentor Details:</h3>
            <p><strong>Name:</strong> ${mentorName}</p>
            <p><strong>Email:</strong> ${mentorEmail}</p>
          </div>
          
          <p>Please review the mentor profile and approve credential sharing when ready.</p>
          
          <div style="text-align: center;">
            <a href="${PORTAL_URL}/app/admin/users" class="button">Review in Portal</a>
          </div>
          
          <p>Best regards,<br>StartupUniv System</p>
        </div>
        <div class="footer">
          <p>This is an automated email. Please do not reply to this message.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  const msg = {
    to,
    from: EMAIL_FROM,
    subject: `New Mentor Created - ${mentorName} - StartupUniv`,
    html,
  };

  try {
    await sgMail.send(msg);
    console.log(`✅ Mentor creation notification sent to admin ${to}`);
  } catch (error) {
    console.error("❌ Error sending mentor creation notification:", error);
    throw error;
  }
}

/**
 * Send notification email to admin about candidate selection request
 */
export async function sendCandidateSelectionNotificationToAdmin(
  to: string,
  candidateName: string,
  candidateEmail: string,
  passed: boolean
): Promise<void> {
  const sendGridApiKey = getSendGridKey();
  if (!sendGridApiKey) {
    throw new Error("SENDGRID_API_KEY or EMAIL_HOST_PASSWORD not configured");
  }

  const statusText = passed ? "passed" : "failed";
  const statusColor = passed ? "#28a745" : "#dc3545";

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
        .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
        .info-box { background: white; padding: 20px; border-radius: 5px; margin: 20px 0; border-left: 4px solid ${statusColor}; }
        .button { display: inline-block; padding: 12px 30px; background: #667eea; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
        .footer { text-align: center; margin-top: 30px; color: #666; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>📋 Candidate Assessment Review</h1>
        </div>
        <div class="content">
          <p>Hello,</p>
          
          <p>A candidate has completed their assessment and the manager has reviewed the results.</p>
          
          <div class="info-box">
            <h3>Candidate Details:</h3>
            <p><strong>Name:</strong> ${candidateName}</p>
            <p><strong>Email:</strong> ${candidateEmail}</p>
            <p><strong>Assessment Result:</strong> <span style="color: ${statusColor}; font-weight: bold;">${statusText.toUpperCase()}</span></p>
          </div>
          
          ${passed ? `<p>The manager has requested to share credentials with this candidate as they have passed the assessment.</p>` : `<p>The candidate has failed the assessment.</p>`}
          
          <p>Please review the candidate's application and assessment results in the portal.</p>
          
          <div style="text-align: center;">
            <a href="${PORTAL_URL}/app/admin/applications" class="button">Review in Portal</a>
          </div>
          
          <p>Best regards,<br>StartupUniv System</p>
        </div>
        <div class="footer">
          <p>This is an automated email. Please do not reply to this message.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  const msg = {
    to,
    from: EMAIL_FROM,
    subject: `Candidate Assessment Review - ${candidateName} - StartupUniv`,
    html,
  };

  try {
    await sgMail.send(msg);
    console.log(`✅ Candidate selection notification sent to admin ${to}`);
  } catch (error) {
    console.error("❌ Error sending candidate selection notification:", error);
    throw error;
  }
}

/**
 * Send contact form inquiry email to info@startupvarsity.com
 */
export async function sendContactFormEmail(
  name: string,
  email: string,
  phone: string | null,
  subject: string,
  message: string
): Promise<void> {
  const sendGridApiKey = getSendGridKey();
  if (!sendGridApiKey) {
    throw new Error("SENDGRID_API_KEY or EMAIL_HOST_PASSWORD not configured");
  }

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #dc2626 0%, #dc2626 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
        .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
        .inquiry-details { background: white; padding: 20px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #dc2626; }
        .detail-row { margin: 10px 0; }
        .label { font-weight: bold; color: #666; }
        .value { color: #333; }
        .footer { text-align: center; margin-top: 30px; color: #666; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>📧 New Contact Form Inquiry</h1>
        </div>
        <div class="content">
          <p>You have received a new inquiry from the StartupUniv contact form:</p>
          
          <div class="inquiry-details">
            <div class="detail-row">
              <span class="label">Name:</span>
              <span class="value">${name}</span>
            </div>
            <div class="detail-row">
              <span class="label">Email:</span>
              <span class="value"><a href="mailto:${email}">${email}</a></span>
            </div>
            ${phone ? `
            <div class="detail-row">
              <span class="label">Phone:</span>
              <span class="value"><a href="tel:${phone}">${phone}</a></span>
            </div>
            ` : ''}
            <div class="detail-row">
              <span class="label">Subject:</span>
              <span class="value">${subject}</span>
            </div>
            <div class="detail-row" style="margin-top: 20px;">
              <span class="label">Message:</span>
              <div class="value" style="margin-top: 10px; padding: 15px; background: #f5f5f5; border-radius: 5px; white-space: pre-wrap;">${message}</div>
            </div>
          </div>
          
          <p style="margin-top: 20px;">Please respond to this inquiry within 24-48 hours.</p>
        </div>
        <div class="footer">
          <p>This email was sent from the StartupUniv contact form.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  const msg = {
    to: "info@startupvarsity.com",
    from: EMAIL_FROM,
    replyTo: email,
    subject: `Contact Form: ${subject} - ${name}`,
    html,
  };

  try {
    await sgMail.send(msg);
    console.log(`✅ Contact form email sent to info@startupvarsity.com from ${email}`);
  } catch (error) {
    console.error("❌ Error sending contact form email:", error);
    throw error;
  }
}

/**
 * Send offer email with payment link
 */
export async function sendOfferEmail(
  to: string,
  name: string,
  totalAmount: number,
  installmentPlan: any[],
  offerExpiresAt: Date,
  applicationId: string
): Promise<void> {
  const sendGridApiKey = getSendGridKey();
  if (!sendGridApiKey) {
    console.warn("⚠️  Email not configured. Skipping offer email.");
    return;
  }

  const paymentUrl = `${PAYMENT_PORTAL_URL}/payment/${applicationId}`;
  const expiryTime = new Date(offerExpiresAt);
  const hoursRemaining = Math.ceil((expiryTime.getTime() - Date.now()) / (1000 * 60 * 60));

  const installmentsHtml = installmentPlan
    .map(
      (inst, idx) => {
        // Determine label based on installment type or number
        let installmentLabel = "";
        if (inst.installmentType === "REGISTRATION_FEE" || inst.installmentNumber === 1) {
          installmentLabel = "Registration Fee";
        } else if (inst.installmentType === "INSTALLMENT_1" || inst.installmentNumber === 2) {
          installmentLabel = "Installment 1";
        } else if (inst.installmentType === "INSTALLMENT_2" || inst.installmentNumber === 3) {
          installmentLabel = "Installment 2";
        } else {
          installmentLabel = `Installment ${inst.installmentNumber - 1}`;
        }
        
        return `
    <tr>
      <td style="padding: 10px; border: 1px solid #ddd;">${installmentLabel}</td>
      <td style="padding: 10px; border: 1px solid #ddd;">₹${inst.amount.toFixed(2)}</td>
      <td style="padding: 10px; border: 1px solid #ddd;">${
        idx === 0 ? "Within 24 hours" : new Date(inst.dueDate).toLocaleDateString()
      }</td>
    </tr>
  `;
      }
    )
    .join("");

  const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>You've Been Selected - StartupUniv</title>
    </head>
    <body style="margin: 0; padding: 0; font-family: Arial, Helvetica, sans-serif; line-height: 1.6; color: #333333; background-color: #f4f4f4;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f4; padding: 20px 0;">
        <tr>
          <td align="center">
            <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width: 600px; width: 100%; background-color: #ffffff; border-radius: 10px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
              
              <!-- HEADER -->
              <tr>
                <td style="background: linear-gradient(135deg, #4CAF50 0%, #45a049 100%); background-color: #4CAF50; color: #ffffff; padding: 30px 20px; text-align: center;">
                  <h1 style="margin: 0 0 8px 0; font-size: 24px; color: #ffffff;">🎉 Congratulations, ${name}!</h1>
                  <h2 style="margin: 0; font-size: 18px; font-weight: normal; color: #ffffff;">You've Been Selected for StartupUniv</h2>
                </td>
              </tr>
              
              <!-- BODY -->
              <tr>
                <td style="padding: 30px 25px; background-color: #ffffff;">
                  
                  <p style="margin: 0 0 16px 0; font-size: 16px; color: #333333;">Dear ${name},</p>
                  
                  <p style="margin: 0 0 20px 0; font-size: 16px; color: #333333;">We are thrilled to inform you that you have been selected for the <strong>StartupUniv 4-month Incubation Program</strong>!</p>
                  
                  <!-- URGENCY BOX -->
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin: 0 0 20px 0;">
                    <tr>
                      <td style="background-color: #fff3cd; padding: 15px 20px; border-radius: 5px; border-left: 4px solid #ffc107;">
                        <h3 style="margin: 0 0 8px 0; font-size: 16px; color: #856404;">⏰ IMPORTANT: Complete Payment Within ${hoursRemaining} Hours</h3>
                        <p style="margin: 0 0 6px 0; font-size: 14px; color: #856404;">Your offer expires on <strong>${expiryTime.toLocaleString()}</strong></p>
                        <p style="margin: 0; font-size: 14px; color: #856404;">Please complete the registration fee payment to confirm your seat.</p>
                      </td>
                    </tr>
                  </table>

                  <!-- ============================================ -->
                  <!-- PAY NOW BUTTON (above payment details) -->
                  <!-- ============================================ -->
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin: 10px 0 25px 0;">
                    <tr>
                      <td align="center">
                        <!--[if mso]>
                        <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${paymentUrl}" style="height:50px;v-text-anchor:middle;width:280px;" arcsize="10%" strokecolor="#388E3C" fillcolor="#4CAF50">
                          <w:anchorlock/>
                          <center style="color:#ffffff;font-family:Arial,sans-serif;font-size:18px;font-weight:bold;">💳 Pay Now & Confirm Seat</center>
                        </v:roundrect>
                        <![endif]-->
                        <!--[if !mso]><!-->
                        <a href="${paymentUrl}" target="_blank" style="display: inline-block; padding: 16px 48px; background-color: #4CAF50; color: #ffffff; text-decoration: none; border-radius: 6px; font-size: 18px; font-weight: bold; font-family: Arial, Helvetica, sans-serif; border: 2px solid #388E3C; text-align: center; mso-padding-alt: 0; mso-hide: all;">💳 Pay Now &amp; Confirm Seat</a>
                        <!--<![endif]-->
                      </td>
                    </tr>
                    <tr>
                      <td align="center" style="padding-top: 10px;">
                        <p style="margin: 0; font-size: 12px; color: #888888;">If the button doesn't work, copy this link: <a href="${paymentUrl}" style="color: #4CAF50; word-break: break-all;">${paymentUrl}</a></p>
                      </td>
                    </tr>
                  </table>
                  
                  <!-- PAYMENT DETAILS BOX -->
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin: 0 0 20px 0;">
                    <tr>
                      <td style="background-color: #f9f9f9; padding: 20px; border-radius: 5px; border-left: 4px solid #4CAF50;">
                        <h3 style="margin: 0 0 12px 0; font-size: 16px; color: #333333;">Payment Details</h3>
                        <p style="margin: 0 0 6px 0; font-size: 14px; color: #333333;"><strong>Total Program Fee:</strong> ₹${totalAmount.toLocaleString()}</p>
                        <p style="margin: 0 0 12px 0; font-size: 14px; color: #333333;"><strong>Payment Plan:</strong> 1 Registration Fee + 2 Installments</p>
                        
                        <!-- Installments Table -->
                        <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse: collapse; margin: 10px 0 0 0; background-color: #ffffff; border: 1px solid #dddddd;">
                          <thead>
                            <tr>
                              <th style="background-color: #4CAF50; color: #ffffff; padding: 10px; text-align: left; font-size: 14px; border: 1px solid #4CAF50;">Installment</th>
                              <th style="background-color: #4CAF50; color: #ffffff; padding: 10px; text-align: left; font-size: 14px; border: 1px solid #4CAF50;">Amount</th>
                              <th style="background-color: #4CAF50; color: #ffffff; padding: 10px; text-align: left; font-size: 14px; border: 1px solid #4CAF50;">Due Date</th>
                            </tr>
                          </thead>
                          <tbody>
                            ${installmentsHtml}
                          </tbody>
                        </table>
                      </td>
                    </tr>
                  </table>

                  <!-- SECOND PAY NOW BUTTON (after payment details) -->
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin: 5px 0 25px 0;">
                    <tr>
                      <td align="center">
                        <a href="${paymentUrl}" target="_blank" style="display: inline-block; padding: 14px 40px; background-color: #FF9800; color: #ffffff; text-decoration: none; border-radius: 6px; font-size: 16px; font-weight: bold; font-family: Arial, Helvetica, sans-serif; border: 2px solid #F57C00; text-align: center;">🔒 Complete Payment Now</a>
                      </td>
                    </tr>
                  </table>
                  
                  <!-- NEXT STEPS -->
                  <p style="margin: 0 0 8px 0; font-size: 15px; color: #333333;"><strong>What Happens Next?</strong></p>
                  <ul style="margin: 0 0 20px 0; padding-left: 20px; font-size: 14px; color: #555555;">
                    <li style="margin-bottom: 6px;">Complete the registration fee payment</li>
                    <li style="margin-bottom: 6px;">Receive your portal access credentials</li>
                    <li style="margin-bottom: 6px;">Start your entrepreneurial journey with expert mentorship</li>
                  </ul>
                  
                  <p style="margin: 0 0 8px 0; font-size: 14px; color: #333333;">If you have any questions or need assistance, please contact us at:</p>
                  <p style="margin: 0 0 16px 0; font-size: 14px; color: #333333;">📧 Email: ${EMAIL_FROM}<br>📞 Phone: ${process.env.COMPANY_PHONE || "Contact admin"}</p>
                  
                  <p style="margin: 0 0 8px 0; font-size: 14px; color: #333333;">We look forward to having you in our program!</p>
                  
                  <p style="margin: 0; font-size: 14px; color: #333333;">Best regards,<br><strong>The StartupUniv Team</strong></p>
                </td>
              </tr>
              
              <!-- FOOTER -->
              <tr>
                <td style="padding: 20px; text-align: center; background-color: #f4f4f4; border-top: 1px solid #eeeeee;">
                  <p style="margin: 0; font-size: 12px; color: #999999;">This is an automated email. Please do not reply to this message.</p>
                  <p style="margin: 8px 0 0 0; font-size: 12px; color: #999999;">© ${new Date().getFullYear()} StartupUniv. All rights reserved.</p>
                </td>
              </tr>
              
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;

  const msg = {
    to,
    from: EMAIL_FROM,
    subject: "🎉 Congratulations! You've Been Selected - Pay to Confirm Your Seat",
    html,
  };

  console.log(`📧 Sending offer email to ${to}`);

  try {
    await sgMail.send(msg);
    console.log(`✅ Offer email sent to ${to}`);
  } catch (error: any) {
    console.error("Failed to send offer email:", error.response?.body || error.message);
    throw error;
  }
}

/**
 * Send payment failure email
 */
export async function sendPaymentFailureEmail(
  to: string,
  name: string,
  amount: number,
  reason: string,
  applicationId: string,
  attemptsLeft: number
): Promise<void> {
  const sendGridApiKey = getSendGridKey();
  if (!sendGridApiKey) {
    console.warn("⚠️  Email not configured. Skipping payment failure email.");
    return;
  }

  const paymentUrl = `${PAYMENT_PORTAL_URL}/payment/${applicationId}`;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #f44336 0%, #d32f2f 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
        .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
        .error-box { background: #ffebee; padding: 20px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #f44336; }
        .button { display: inline-block; padding: 12px 30px; background: #4CAF50; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
        .footer { text-align: center; margin-top: 30px; color: #666; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>⚠️ Payment Failed</h1>
        </div>
        <div class="content">
          <p>Dear ${name},</p>
          
          <p>Your payment of <strong>₹${amount.toFixed(2)}</strong> could not be processed.</p>
          
          <div class="error-box">
            <h3>Reason:</h3>
            <p>${reason}</p>
            <p><strong>Retry attempts remaining:</strong> ${attemptsLeft}</p>
          </div>
          
          <p>Please retry the payment using the button below:</p>
          
          <div style="text-align: center;">
            <a href="${paymentUrl}" class="button">Retry Payment</a>
          </div>
          
          <p><strong>Need Help?</strong></p>
          <p>If you continue to face issues, please contact us:</p>
          <p>📧 Email: ${EMAIL_FROM}<br>
          📞 Phone: ${process.env.COMPANY_PHONE || "Contact admin"}</p>
          
          <p>Best regards,<br>StartupUniv Team</p>
        </div>
        <div class="footer">
          <p>This is an automated email. Please do not reply to this message.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  const msg = {
    to,
    from: EMAIL_FROM,
    subject: "⚠️ Payment Failed - Action Required",
    html,
  };

  try {
    await sgMail.send(msg);
    console.log(`✅ Payment failure email sent to ${to}`);
  } catch (error) {
    console.error("❌ Error sending payment failure email:", error);
  }
}

/**
 * Send payment reminder email
 */
export async function sendPaymentReminderEmail(
  to: string,
  name: string,
  amount: number,
  dueDate: Date,
  applicationId: string,
  daysRemaining: number
): Promise<void> {
  const sendGridApiKey = getSendGridKey();
  if (!sendGridApiKey) {
    console.warn("⚠️  Email not configured. Skipping payment reminder email.");
    return;
  }

  const paymentUrl = `${PAYMENT_PORTAL_URL}/payment/${applicationId}`;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #FF9800 0%, #F57C00 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
        .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
        .reminder-box { background: #fff3cd; padding: 20px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #ffc107; }
        .button { display: inline-block; padding: 12px 30px; background: #FF9800; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
        .footer { text-align: center; margin-top: 30px; color: #666; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>⏰ Payment Reminder</h1>
        </div>
        <div class="content">
          <p>Dear ${name},</p>
          
          <p>This is a friendly reminder that your next installment payment is due soon.</p>
          
          <div class="reminder-box">
            <h3>Payment Details:</h3>
            <p><strong>Amount:</strong> ₹${amount.toFixed(2)}</p>
            <p><strong>Due Date:</strong> ${dueDate.toLocaleDateString()}</p>
            <p><strong>Days Remaining:</strong> ${daysRemaining} day${daysRemaining > 1 ? "s" : ""}</p>
          </div>
          
          <div style="text-align: center;">
            <a href="${paymentUrl}" class="button">Pay Now</a>
          </div>
          
          <p>Timely payment ensures uninterrupted access to the program benefits.</p>
          
          <p>If you have any questions, please contact us:</p>
          <p>📧 Email: ${EMAIL_FROM}</p>
          
          <p>Best regards,<br>StartupUniv Team</p>
        </div>
        <div class="footer">
          <p>This is an automated email. Please do not reply to this message.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  const msg = {
    to,
    from: EMAIL_FROM,
    subject: `⏰ Reminder: Payment Due in ${daysRemaining} Day${daysRemaining > 1 ? "s" : ""}`,
    html,
  };

  try {
    await sgMail.send(msg);
    console.log(`✅ Payment reminder email sent to ${to}`);
  } catch (error) {
    console.error("❌ Error sending payment reminder email:", error);
  }
}


