import nodemailer from "nodemailer";
import type { Deal } from "@shared/schema";

const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_PORT = parseInt(process.env.SMTP_PORT || "587");
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;
const SMTP_FROM = process.env.SMTP_FROM || "noreply@qatarliving.com";
const DASHBOARD_URL = process.env.DASHBOARD_URL || "https://your-domain.replit.app";

const isEmailConfigured = SMTP_HOST && SMTP_USER && SMTP_PASS;

const transporter = isEmailConfigured 
  ? nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_PORT === 465,
      auth: {
        user: SMTP_USER,
        pass: SMTP_PASS,
      },
    })
  : null;

export async function sendNewDealNotification(deal: Deal, recipientEmails: string[]): Promise<void> {
  if (!isEmailConfigured) {
    console.log("[Email] SMTP not configured. Skipping email notification.");
    console.log("[Email] To enable emails, set SMTP_HOST, SMTP_USER, and SMTP_PASS environment variables.");
    return;
  }

  if (recipientEmails.length === 0) {
    console.log("[Email] No recipients configured. Skipping email notification.");
    return;
  }

  const subject = `New Deal Request: ${deal.title}`;
  
  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>New Deal Request</title>
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: #00426D; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
        <h1 style="color: white; margin: 0; font-size: 24px;">Qatar Living Deals</h1>
        <p style="color: rgba(255,255,255,0.8); margin: 5px 0 0 0; font-size: 14px;">New Deal Request Submitted</p>
      </div>
      
      <div style="background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; border: 1px solid #e5e7eb; border-top: none;">
        <h2 style="color: #00426D; margin-top: 0; margin-bottom: 20px;">A new deal request has been submitted!</h2>
        
        <div style="background: white; padding: 20px; border-radius: 8px; border: 1px solid #e5e7eb; margin-bottom: 25px;">
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 8px 0; border-bottom: 1px solid #f3f4f6; font-weight: bold; color: #6b7280; width: 140px;">Deal Title:</td>
              <td style="padding: 8px 0; border-bottom: 1px solid #f3f4f6; color: #111827;">${deal.title}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; border-bottom: 1px solid #f3f4f6; font-weight: bold; color: #6b7280;">Category:</td>
              <td style="padding: 8px 0; border-bottom: 1px solid #f3f4f6; color: #111827;">${deal.category} - ${deal.subCategory}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; border-bottom: 1px solid #f3f4f6; font-weight: bold; color: #6b7280;">Deal Type:</td>
              <td style="padding: 8px 0; border-bottom: 1px solid #f3f4f6; color: #111827;">${deal.dealType}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; border-bottom: 1px solid #f3f4f6; font-weight: bold; color: #6b7280;">Merchant:</td>
              <td style="padding: 8px 0; border-bottom: 1px solid #f3f4f6; color: #111827;">${deal.merchantName || "Not specified"}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; border-bottom: 1px solid #f3f4f6; font-weight: bold; color: #6b7280;">Email:</td>
              <td style="padding: 8px 0; border-bottom: 1px solid #f3f4f6; color: #111827;">${deal.merchantEmail || "Not specified"}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; font-weight: bold; color: #6b7280;">Submitted:</td>
              <td style="padding: 8px 0; color: #111827;">${new Date(deal.createdAt).toLocaleString("en-US", { 
                dateStyle: "medium", 
                timeStyle: "short" 
              })}</td>
            </tr>
          </table>
        </div>
        
        <div style="text-align: center;">
          <a href="${DASHBOARD_URL}/admin/dashboard" 
             style="display: inline-block; background: #00426D; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px;">
            View Dashboard
          </a>
        </div>
        
        <p style="color: #6b7280; font-size: 13px; margin-top: 25px; text-align: center;">
          This is an automated notification from Qatar Living Deals Admin Portal.
        </p>
      </div>
    </body>
    </html>
  `;

  const textContent = `
New Deal Request - Qatar Living Deals

A new deal request has been submitted!

Deal Title: ${deal.title}
Category: ${deal.category} - ${deal.subCategory}
Deal Type: ${deal.dealType}
Merchant: ${deal.merchantName || "Not specified"}
Email: ${deal.merchantEmail || "Not specified"}
Submitted: ${new Date(deal.createdAt).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}

View Dashboard: ${DASHBOARD_URL}/admin/dashboard

This is an automated notification from Qatar Living Deals Admin Portal.
  `;

  try {
    await transporter!.sendMail({
      from: SMTP_FROM,
      to: recipientEmails.join(", "),
      subject,
      text: textContent,
      html: htmlContent,
    });
    console.log(`[Email] Notification sent to ${recipientEmails.length} recipient(s)`);
  } catch (error) {
    console.error("[Email] Failed to send notification:", error);
  }
}
