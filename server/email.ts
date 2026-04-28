import nodemailer from "nodemailer";
import type { Deal, Merchant } from "@shared/schema";
import { storage } from "./storage";

const DASHBOARD_URL = process.env.DASHBOARD_URL || "https://ql-deal-creation.qatarliving.com";

async function getEmailTransporter(ignoreEnabledCheck: boolean = false) {
  const settings = await storage.getEmailSettings();
  
  if (!settings || !settings.apiKey) {
    return null;
  }
  
  if (!ignoreEnabledCheck && !settings.isEnabled) {
    return null;
  }

  if (settings.provider === "mandrill") {
    return nodemailer.createTransport({
      host: "smtp.mandrillapp.com",
      port: 587,
      secure: false,
      auth: {
        user: "apikey",
        pass: settings.apiKey,
      },
    });
  }

  return null;
}

export async function sendNewDealNotification(deal: Deal, recipientEmails: string[]): Promise<void> {
  const settings = await storage.getEmailSettings();
  
  if (!settings || !settings.isEnabled) {
    console.log("[Email] Email notifications are disabled. Enable them in Settings.");
    return;
  }

  if (!settings.apiKey) {
    console.log("[Email] No API key configured. Please configure email settings in the dashboard.");
    return;
  }

  if (recipientEmails.length === 0) {
    console.log("[Email] No recipients configured. Skipping email notification.");
    return;
  }

  const transporter = await getEmailTransporter();
  if (!transporter) {
    console.log("[Email] Failed to create email transporter.");
    return;
  }

  const fromEmail = settings.fromEmail || "noreply@qatarliving.com";
  const fromName = settings.fromName || "Qatar Living Deals";
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
    await transporter.sendMail({
      from: `"${fromName}" <${fromEmail}>`,
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

export async function sendModerationNotification(deal: Deal, recipientEmails: string[], forwardedBy: string): Promise<void> {
  const settings = await storage.getEmailSettings();
  
  if (!settings || !settings.isEnabled) {
    console.log("[Email] Email notifications are disabled. Enable them in Settings.");
    return;
  }

  if (!settings.apiKey) {
    console.log("[Email] No API key configured. Please configure email settings in the dashboard.");
    return;
  }

  if (recipientEmails.length === 0) {
    console.log("[Email] No moderation recipients configured. Skipping email notification.");
    return;
  }

  const transporter = await getEmailTransporter();
  if (!transporter) {
    console.log("[Email] Failed to create email transporter.");
    return;
  }

  const fromEmail = settings.fromEmail || "noreply@qatarliving.com";
  const fromName = settings.fromName || "Qatar Living Deals";
  const subject = `Deal Ready for Moderation: ${deal.title}`;
  
  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Deal Ready for Moderation</title>
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: #059669; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
        <h1 style="color: white; margin: 0; font-size: 24px;">Qatar Living Deals</h1>
        <p style="color: rgba(255,255,255,0.8); margin: 5px 0 0 0; font-size: 14px;">Deal Forwarded to Moderation</p>
      </div>
      
      <div style="background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; border: 1px solid #e5e7eb; border-top: none;">
        <div style="background: #dcfce7; padding: 15px; border-radius: 8px; border: 1px solid #bbf7d0; margin-bottom: 20px;">
          <p style="margin: 0; color: #166534; font-weight: bold; text-align: center;">✓ Approved by Sales Team</p>
        </div>
        
        <h2 style="color: #00426D; margin-top: 0; margin-bottom: 20px;">A deal is ready for moderation review!</h2>
        
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
              <td style="padding: 8px 0; border-bottom: 1px solid #f3f4f6; font-weight: bold; color: #6b7280;">Forwarded By:</td>
              <td style="padding: 8px 0; border-bottom: 1px solid #f3f4f6; color: #111827;">${forwardedBy}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; font-weight: bold; color: #6b7280;">Forwarded At:</td>
              <td style="padding: 8px 0; color: #111827;">${new Date().toLocaleString("en-US", { 
                dateStyle: "medium", 
                timeStyle: "short" 
              })}</td>
            </tr>
          </table>
        </div>
        
        <div style="text-align: center;">
          <a href="${DASHBOARD_URL}/admin/deals/${deal.id}" 
             style="display: inline-block; background: #059669; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px;">
            Review Deal
          </a>
        </div>
        
        <p style="color: #6b7280; font-size: 13px; margin-top: 25px; text-align: center;">
          This deal has been approved by the sales team and is ready for moderation review.
        </p>
      </div>
    </body>
    </html>
  `;

  const textContent = `
Deal Ready for Moderation - Qatar Living Deals

A deal is ready for moderation review!

Deal Title: ${deal.title}
Category: ${deal.category} - ${deal.subCategory}
Deal Type: ${deal.dealType}
Merchant: ${deal.merchantName || "Not specified"}
Forwarded By: ${forwardedBy}
Forwarded At: ${new Date().toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}

Review Deal: ${DASHBOARD_URL}/admin/deals/${deal.id}

This deal has been approved by the sales team and is ready for moderation review.
  `;

  try {
    await transporter.sendMail({
      from: `"${fromName}" <${fromEmail}>`,
      to: recipientEmails.join(", "),
      subject,
      text: textContent,
      html: htmlContent,
    });
    console.log(`[Email] Moderation notification sent to ${recipientEmails.length} recipient(s)`);
  } catch (error) {
    console.error("[Email] Failed to send moderation notification:", error);
  }
}

export async function sendMerchantConfirmation(deal: Deal): Promise<void> {
  if (!deal.merchantEmail) {
    console.log("[Email] No merchant email provided. Skipping confirmation email.");
    return;
  }

  const settings = await storage.getEmailSettings();
  
  if (!settings || !settings.isEnabled) {
    console.log("[Email] Email notifications are disabled. Skipping merchant confirmation.");
    return;
  }

  if (!settings.apiKey) {
    console.log("[Email] No API key configured. Skipping merchant confirmation.");
    return;
  }

  const transporter = await getEmailTransporter();
  if (!transporter) {
    console.log("[Email] Failed to create email transporter.");
    return;
  }

  const fromEmail = settings.fromEmail || "noreply@qatarliving.com";
  const fromName = settings.fromName || "Qatar Living Deals";
  const subject = `Deal Submission Received: ${deal.title}`;
  
  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Deal Submission Confirmation</title>
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: #00426D; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
        <h1 style="color: white; margin: 0; font-size: 24px;">Qatar Living Deals</h1>
        <p style="color: rgba(255,255,255,0.8); margin: 5px 0 0 0; font-size: 14px;">Deal Submission Confirmation</p>
      </div>
      
      <div style="background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; border: 1px solid #e5e7eb; border-top: none;">
        <div style="background: #dcfce7; padding: 15px; border-radius: 8px; border: 1px solid #bbf7d0; margin-bottom: 20px;">
          <p style="margin: 0; color: #166534; font-weight: bold; text-align: center;">✓ Your Deal Has Been Submitted Successfully!</p>
        </div>
        
        <p style="color: #374151; margin-bottom: 20px;">Dear ${deal.merchantName || "Valued Merchant"},</p>
        
        <p style="color: #374151; margin-bottom: 20px;">Thank you for submitting your deal to Qatar Living Deals! We have received your submission and our team will review it shortly.</p>
        
        <h3 style="color: #00426D; margin-bottom: 15px;">Submission Details:</h3>
        
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
              <td style="padding: 8px 0; font-weight: bold; color: #6b7280;">Submitted On:</td>
              <td style="padding: 8px 0; color: #111827;">${new Date(deal.createdAt).toLocaleString("en-US", { 
                dateStyle: "medium", 
                timeStyle: "short" 
              })}</td>
            </tr>
          </table>
        </div>
        
        <p style="color: #374151; margin-top: 20px;">Your deal is now under review by the Qatar Living Deals team. We will be in touch if we need any additional information.</p>
        
        <p style="color: #374151; margin-top: 15px;">If you have any questions, please don't hesitate to contact us.</p>
        
        <p style="color: #374151; margin-top: 20px;">
          Best regards,<br>
          <strong>The Qatar Living Deals Team</strong>
        </p>
        
        <p style="color: #6b7280; font-size: 13px; margin-top: 25px; text-align: center; border-top: 1px solid #e5e7eb; padding-top: 20px;">
          This is an automated confirmation email from Qatar Living Deals.
        </p>
      </div>
    </body>
    </html>
  `;

  const textContent = `
Deal Submission Confirmation - Qatar Living Deals

Dear ${deal.merchantName || "Valued Merchant"},

Thank you for submitting your deal to Qatar Living Deals! We have received your submission and our team will review it shortly.

Submission Details:
- Deal Title: ${deal.title}
- Category: ${deal.category} - ${deal.subCategory}
- Deal Type: ${deal.dealType}
- Submitted On: ${new Date(deal.createdAt).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}

Your deal is now under review by the Qatar Living Deals team. We will be in touch if we need any additional information.

If you have any questions, please don't hesitate to contact us.

Best regards,
The Qatar Living Deals Team

This is an automated confirmation email from Qatar Living Deals.
  `;

  try {
    await transporter.sendMail({
      from: `"${fromName}" <${fromEmail}>`,
      to: deal.merchantEmail,
      subject,
      text: textContent,
      html: htmlContent,
    });
    console.log(`[Email] Merchant confirmation sent to ${deal.merchantEmail}`);
  } catch (error) {
    console.error("[Email] Failed to send merchant confirmation:", error);
  }
}

export async function sendTestEmail(testEmail: string): Promise<{ success: boolean; error?: string }> {
  const settings = await storage.getEmailSettings();
  
  if (!settings) {
    return { success: false, error: "Email settings not configured. Please save your settings first." };
  }

  if (!settings.apiKey) {
    return { success: false, error: "API key is not configured." };
  }

  const transporter = await getEmailTransporter(true);
  if (!transporter) {
    return { success: false, error: "Failed to create email transporter. Please check your API key is valid." };
  }

  const fromEmail = settings.fromEmail || "noreply@qatarliving.com";
  const fromName = settings.fromName || "Qatar Living Deals";

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Test Email</title>
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: #00426D; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
        <h1 style="color: white; margin: 0; font-size: 24px;">Qatar Living Deals</h1>
        <p style="color: rgba(255,255,255,0.8); margin: 5px 0 0 0; font-size: 14px;">Test Email</p>
      </div>
      
      <div style="background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; border: 1px solid #e5e7eb; border-top: none;">
        <h2 style="color: #00426D; margin-top: 0; margin-bottom: 20px;">Your email configuration is working!</h2>
        
        <div style="background: white; padding: 20px; border-radius: 8px; border: 1px solid #e5e7eb; margin-bottom: 25px;">
          <p style="margin: 0; color: #374151;">This is a test email from the Qatar Living Deals Admin Portal.</p>
          <p style="margin: 15px 0 0 0; color: #6b7280;">If you received this email, your email settings are configured correctly and notifications will be sent when new deal requests are submitted.</p>
        </div>

        <div style="background: #dcfce7; padding: 15px; border-radius: 8px; border: 1px solid #bbf7d0; text-align: center;">
          <p style="margin: 0; color: #166534; font-weight: bold;">✓ Email Configuration Verified</p>
        </div>
        
        <p style="color: #6b7280; font-size: 13px; margin-top: 25px; text-align: center;">
          Sent at: ${new Date().toLocaleString("en-US", { dateStyle: "full", timeStyle: "medium" })}
        </p>
      </div>
    </body>
    </html>
  `;

  try {
    await transporter.sendMail({
      from: `"${fromName}" <${fromEmail}>`,
      to: testEmail,
      subject: "Test Email - Qatar Living Deals",
      text: "This is a test email from Qatar Living Deals. Your email configuration is working correctly!",
      html: htmlContent,
    });
    console.log(`[Email] Test email sent to ${testEmail}`);
    return { success: true };
  } catch (error: any) {
    console.error("[Email] Failed to send test email:", error);
    return { 
      success: false, 
      error: error.message || "Failed to send test email. Please check your API key and settings." 
    };
  }
}

// Merchant Onboarding Email Functions

export async function sendMerchantOnboardingNotification(merchant: Merchant, recipientEmails: string[]): Promise<void> {
  const settings = await storage.getEmailSettings();
  
  if (!settings || !settings.isEnabled) {
    console.log("[Email] Email notifications are disabled. Enable them in Settings.");
    return;
  }

  if (!settings.apiKey) {
    console.log("[Email] No API key configured. Please configure email settings in the dashboard.");
    return;
  }

  if (recipientEmails.length === 0) {
    console.log("[Email] No recipients configured. Skipping email notification.");
    return;
  }

  const transporter = await getEmailTransporter();
  if (!transporter) {
    console.log("[Email] Failed to create email transporter.");
    return;
  }

  const fromEmail = settings.fromEmail || "noreply@qatarliving.com";
  const fromName = settings.fromName || "Qatar Living Deals";
  const subject = `New Merchant Application: ${merchant.companyName}`;
  
  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>New Merchant Application</title>
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: #00426D; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
        <h1 style="color: white; margin: 0; font-size: 24px;">Qatar Living Deals</h1>
        <p style="color: rgba(255,255,255,0.8); margin: 5px 0 0 0; font-size: 14px;">New Merchant Application Submitted</p>
      </div>
      
      <div style="background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; border: 1px solid #e5e7eb; border-top: none;">
        <h2 style="color: #00426D; margin-top: 0; margin-bottom: 20px;">A new merchant application has been submitted!</h2>
        
        <div style="background: white; padding: 20px; border-radius: 8px; border: 1px solid #e5e7eb; margin-bottom: 25px;">
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 8px 0; border-bottom: 1px solid #f3f4f6; font-weight: bold; color: #6b7280; width: 140px;">Company Name:</td>
              <td style="padding: 8px 0; border-bottom: 1px solid #f3f4f6; color: #111827;">${merchant.companyName}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; border-bottom: 1px solid #f3f4f6; font-weight: bold; color: #6b7280;">Brand Name:</td>
              <td style="padding: 8px 0; border-bottom: 1px solid #f3f4f6; color: #111827;">${merchant.brandName}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; border-bottom: 1px solid #f3f4f6; font-weight: bold; color: #6b7280;">CR Number:</td>
              <td style="padding: 8px 0; border-bottom: 1px solid #f3f4f6; color: #111827;">${merchant.crNumber}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; border-bottom: 1px solid #f3f4f6; font-weight: bold; color: #6b7280;">Contact Person:</td>
              <td style="padding: 8px 0; border-bottom: 1px solid #f3f4f6; color: #111827;">${merchant.contactPerson}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; border-bottom: 1px solid #f3f4f6; font-weight: bold; color: #6b7280;">Email:</td>
              <td style="padding: 8px 0; border-bottom: 1px solid #f3f4f6; color: #111827;">${merchant.email}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; font-weight: bold; color: #6b7280;">Submitted:</td>
              <td style="padding: 8px 0; color: #111827;">${new Date(merchant.createdAt).toLocaleString("en-US", { 
                dateStyle: "medium", 
                timeStyle: "short" 
              })}</td>
            </tr>
          </table>
        </div>
        
        <div style="text-align: center;">
          <a href="${DASHBOARD_URL}/admin/merchants/${merchant.id}" 
             style="display: inline-block; background: #00426D; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px;">
            View Application
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
New Merchant Application - Qatar Living Deals

A new merchant application has been submitted!

Company Name: ${merchant.companyName}
Brand Name: ${merchant.brandName}
CR Number: ${merchant.crNumber}
Contact Person: ${merchant.contactPerson}
Email: ${merchant.email}
Submitted: ${new Date(merchant.createdAt).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}

View Application: ${DASHBOARD_URL}/admin/merchants/${merchant.id}

This is an automated notification from Qatar Living Deals Admin Portal.
  `;

  try {
    await transporter.sendMail({
      from: `"${fromName}" <${fromEmail}>`,
      to: recipientEmails.join(", "),
      subject,
      text: textContent,
      html: htmlContent,
    });
    console.log(`[Email] Merchant onboarding notification sent to ${recipientEmails.length} recipient(s)`);
  } catch (error) {
    console.error("[Email] Failed to send merchant onboarding notification:", error);
  }
}

export async function sendMerchantModerationNotification(merchant: Merchant, recipientEmails: string[], forwardedBy: string): Promise<void> {
  const settings = await storage.getEmailSettings();
  
  if (!settings || !settings.isEnabled) {
    console.log("[Email] Email notifications are disabled. Enable them in Settings.");
    return;
  }

  if (!settings.apiKey) {
    console.log("[Email] No API key configured. Please configure email settings in the dashboard.");
    return;
  }

  if (recipientEmails.length === 0) {
    console.log("[Email] No moderation recipients configured. Skipping email notification.");
    return;
  }

  const transporter = await getEmailTransporter();
  if (!transporter) {
    console.log("[Email] Failed to create email transporter.");
    return;
  }

  const fromEmail = settings.fromEmail || "noreply@qatarliving.com";
  const fromName = settings.fromName || "Qatar Living Deals";
  const subject = `Merchant Ready for Moderation: ${merchant.companyName}`;
  
  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Merchant Ready for Moderation</title>
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: #059669; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
        <h1 style="color: white; margin: 0; font-size: 24px;">Qatar Living Deals</h1>
        <p style="color: rgba(255,255,255,0.8); margin: 5px 0 0 0; font-size: 14px;">Merchant Forwarded to Moderation</p>
      </div>
      
      <div style="background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; border: 1px solid #e5e7eb; border-top: none;">
        <div style="background: #dcfce7; padding: 15px; border-radius: 8px; border: 1px solid #bbf7d0; margin-bottom: 20px;">
          <p style="margin: 0; color: #166534; font-weight: bold; text-align: center;">✓ Approved by Sales Team</p>
        </div>
        
        <h2 style="color: #00426D; margin-top: 0; margin-bottom: 20px;">A merchant is ready for moderation review!</h2>
        
        <div style="background: white; padding: 20px; border-radius: 8px; border: 1px solid #e5e7eb; margin-bottom: 25px;">
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 8px 0; border-bottom: 1px solid #f3f4f6; font-weight: bold; color: #6b7280; width: 140px;">Company Name:</td>
              <td style="padding: 8px 0; border-bottom: 1px solid #f3f4f6; color: #111827;">${merchant.companyName}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; border-bottom: 1px solid #f3f4f6; font-weight: bold; color: #6b7280;">Brand Name:</td>
              <td style="padding: 8px 0; border-bottom: 1px solid #f3f4f6; color: #111827;">${merchant.brandName}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; border-bottom: 1px solid #f3f4f6; font-weight: bold; color: #6b7280;">Contact Person:</td>
              <td style="padding: 8px 0; border-bottom: 1px solid #f3f4f6; color: #111827;">${merchant.contactPerson}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; border-bottom: 1px solid #f3f4f6; font-weight: bold; color: #6b7280;">Forwarded By:</td>
              <td style="padding: 8px 0; border-bottom: 1px solid #f3f4f6; color: #111827;">${forwardedBy}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; font-weight: bold; color: #6b7280;">Forwarded At:</td>
              <td style="padding: 8px 0; color: #111827;">${new Date().toLocaleString("en-US", { 
                dateStyle: "medium", 
                timeStyle: "short" 
              })}</td>
            </tr>
          </table>
        </div>
        
        <div style="text-align: center;">
          <a href="${DASHBOARD_URL}/admin/merchants/${merchant.id}" 
             style="display: inline-block; background: #059669; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px;">
            Review Merchant
          </a>
        </div>
        
        <p style="color: #6b7280; font-size: 13px; margin-top: 25px; text-align: center;">
          This merchant has been approved by the sales team and is ready for moderation review.
        </p>
      </div>
    </body>
    </html>
  `;

  const textContent = `
Merchant Ready for Moderation - Qatar Living Deals

A merchant is ready for moderation review!

Company Name: ${merchant.companyName}
Brand Name: ${merchant.brandName}
Contact Person: ${merchant.contactPerson}
Forwarded By: ${forwardedBy}
Forwarded At: ${new Date().toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}

Review Merchant: ${DASHBOARD_URL}/admin/merchants/${merchant.id}

This merchant has been approved by the sales team and is ready for moderation review.
  `;

  try {
    await transporter.sendMail({
      from: `"${fromName}" <${fromEmail}>`,
      to: recipientEmails.join(", "),
      subject,
      text: textContent,
      html: htmlContent,
    });
    console.log(`[Email] Merchant moderation notification sent to ${recipientEmails.length} recipient(s)`);
  } catch (error) {
    console.error("[Email] Failed to send merchant moderation notification:", error);
  }
}

export async function sendMerchantOnboardingConfirmation(merchant: Merchant): Promise<void> {
  if (!merchant.email) {
    console.log("[Email] No merchant email provided. Skipping confirmation email.");
    return;
  }

  const settings = await storage.getEmailSettings();
  
  if (!settings || !settings.isEnabled) {
    console.log("[Email] Email notifications are disabled. Skipping merchant confirmation.");
    return;
  }

  if (!settings.apiKey) {
    console.log("[Email] No API key configured. Skipping merchant confirmation.");
    return;
  }

  const transporter = await getEmailTransporter();
  if (!transporter) {
    console.log("[Email] Failed to create email transporter.");
    return;
  }

  const fromEmail = settings.fromEmail || "noreply@qatarliving.com";
  const fromName = settings.fromName || "Qatar Living Deals";
  const subject = `Application Received: ${merchant.companyName}`;
  
  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Merchant Application Confirmation</title>
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: #00426D; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
        <h1 style="color: white; margin: 0; font-size: 24px;">Qatar Living Deals</h1>
        <p style="color: rgba(255,255,255,0.8); margin: 5px 0 0 0; font-size: 14px;">Merchant Application Confirmation</p>
      </div>
      
      <div style="background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; border: 1px solid #e5e7eb; border-top: none;">
        <div style="background: #dcfce7; padding: 15px; border-radius: 8px; border: 1px solid #bbf7d0; margin-bottom: 20px;">
          <p style="margin: 0; color: #166534; font-weight: bold; text-align: center;">✓ Your Application Has Been Submitted Successfully!</p>
        </div>
        
        <p style="color: #374151; margin-bottom: 20px;">Dear ${merchant.contactPerson},</p>
        
        <p style="color: #374151; margin-bottom: 20px;">Thank you for submitting your merchant application to Qatar Living Deals! We have received your application and our team will review it shortly.</p>
        
        <h3 style="color: #00426D; margin-bottom: 15px;">Application Details:</h3>
        
        <div style="background: white; padding: 20px; border-radius: 8px; border: 1px solid #e5e7eb; margin-bottom: 25px;">
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 8px 0; border-bottom: 1px solid #f3f4f6; font-weight: bold; color: #6b7280; width: 140px;">Company Name:</td>
              <td style="padding: 8px 0; border-bottom: 1px solid #f3f4f6; color: #111827;">${merchant.companyName}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; border-bottom: 1px solid #f3f4f6; font-weight: bold; color: #6b7280;">Brand Name:</td>
              <td style="padding: 8px 0; border-bottom: 1px solid #f3f4f6; color: #111827;">${merchant.brandName}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; font-weight: bold; color: #6b7280;">Submitted On:</td>
              <td style="padding: 8px 0; color: #111827;">${new Date(merchant.createdAt).toLocaleString("en-US", { 
                dateStyle: "medium", 
                timeStyle: "short" 
              })}</td>
            </tr>
          </table>
        </div>
        
        <p style="color: #374151; margin-top: 20px;"><strong>Next Steps:</strong></p>
        <ol style="color: #374151; margin-top: 10px; padding-left: 20px;">
          <li>Download your partnership agreement from the success page</li>
          <li>Print, sign, and stamp the agreement</li>
          <li>Upload the signed copy back to complete your application</li>
        </ol>
        
        <p style="color: #374151; margin-top: 15px;">If you have any questions, please don't hesitate to contact us.</p>
        
        <p style="color: #374151; margin-top: 20px;">
          Best regards,<br>
          <strong>The Qatar Living Deals Team</strong>
        </p>
        
        <p style="color: #6b7280; font-size: 13px; margin-top: 25px; text-align: center; border-top: 1px solid #e5e7eb; padding-top: 20px;">
          This is an automated confirmation email from Qatar Living Deals.
        </p>
      </div>
    </body>
    </html>
  `;

  const textContent = `
Merchant Application Confirmation - Qatar Living Deals

Dear ${merchant.contactPerson},

Thank you for submitting your merchant application to Qatar Living Deals! We have received your application and our team will review it shortly.

Application Details:
- Company Name: ${merchant.companyName}
- Brand Name: ${merchant.brandName}
- Submitted On: ${new Date(merchant.createdAt).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}

Next Steps:
1. Download your partnership agreement from the success page
2. Print, sign, and stamp the agreement
3. Upload the signed copy back to complete your application

If you have any questions, please don't hesitate to contact us.

Best regards,
The Qatar Living Deals Team

This is an automated confirmation email from Qatar Living Deals.
  `;

  try {
    await transporter.sendMail({
      from: `"${fromName}" <${fromEmail}>`,
      to: merchant.email,
      subject,
      text: textContent,
      html: htmlContent,
    });
    console.log(`[Email] Merchant onboarding confirmation sent to ${merchant.email}`);
  } catch (error) {
    console.error("[Email] Failed to send merchant onboarding confirmation:", error);
  }
}

export async function sendMerchantSignedContractConfirmation(merchant: Merchant): Promise<void> {
  if (!merchant.email) {
    console.log("[Email] No merchant email provided. Skipping signed contract confirmation email.");
    return;
  }

  const settings = await storage.getEmailSettings();
  
  if (!settings || !settings.isEnabled) {
    console.log("[Email] Email notifications are disabled. Skipping signed contract confirmation.");
    return;
  }

  if (!settings.apiKey) {
    console.log("[Email] No API key configured. Skipping signed contract confirmation.");
    return;
  }

  const transporter = await getEmailTransporter();
  if (!transporter) {
    console.log("[Email] Failed to create email transporter.");
    return;
  }

  const fromEmail = settings.fromEmail || "noreply@qatarliving.com";
  const fromName = settings.fromName || "Qatar Living Deals";
  const subject = `Signed Contract Received: ${merchant.companyName}`;
  
  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Signed Contract Confirmation</title>
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: #00426D; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
        <h1 style="color: white; margin: 0; font-size: 24px;">Qatar Living Deals</h1>
        <p style="color: rgba(255,255,255,0.8); margin: 5px 0 0 0; font-size: 14px;">Signed Contract Received</p>
      </div>
      
      <div style="background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; border: 1px solid #e5e7eb; border-top: none;">
        <div style="background: #dcfce7; padding: 15px; border-radius: 8px; border: 1px solid #bbf7d0; margin-bottom: 20px;">
          <p style="margin: 0; color: #166534; font-weight: bold; text-align: center;">✓ Your Signed Contract Has Been Received!</p>
        </div>
        
        <p style="color: #374151; margin-bottom: 20px;">Dear ${merchant.contactPerson},</p>
        
        <p style="color: #374151; margin-bottom: 20px;">Thank you for uploading your signed partnership agreement. We have received your signed contract and our team will process your application shortly.</p>
        
        <h3 style="color: #00426D; margin-bottom: 15px;">What's Next?</h3>
        
        <ul style="color: #374151; margin-top: 10px; padding-left: 20px;">
          <li>Our team will review your signed agreement</li>
          <li>You will receive confirmation once your account is activated</li>
          <li>Your deals will be published on Qatar Living</li>
        </ul>
        
        <p style="color: #374151; margin-top: 20px;">If you have any questions, please don't hesitate to contact us.</p>
        
        <p style="color: #374151; margin-top: 20px;">
          Best regards,<br>
          <strong>The Qatar Living Deals Team</strong>
        </p>
        
        <p style="color: #6b7280; font-size: 13px; margin-top: 25px; text-align: center; border-top: 1px solid #e5e7eb; padding-top: 20px;">
          This is an automated confirmation email from Qatar Living Deals.
        </p>
      </div>
    </body>
    </html>
  `;

  const textContent = `
Signed Contract Received - Qatar Living Deals

Dear ${merchant.contactPerson},

Thank you for uploading your signed partnership agreement. We have received your signed contract and our team will process your application shortly.

What's Next?
- Our team will review your signed agreement
- You will receive confirmation once your account is activated
- Your deals will be published on Qatar Living

If you have any questions, please don't hesitate to contact us.

Best regards,
The Qatar Living Deals Team

This is an automated confirmation email from Qatar Living Deals.
  `;

  try {
    await transporter.sendMail({
      from: `"${fromName}" <${fromEmail}>`,
      to: merchant.email,
      subject,
      text: textContent,
      html: htmlContent,
    });
    console.log(`[Email] Signed contract confirmation sent to ${merchant.email}`);
  } catch (error) {
    console.error("[Email] Failed to send signed contract confirmation:", error);
  }
}

// Feedback Email Functions

export async function sendFeedbackNotification(feedback: any, recipientEmails: string[]): Promise<void> {
  const settings = await storage.getEmailSettings();

  if (!settings || !settings.isEnabled) {
    console.log("[Email] Email notifications are disabled. Enable them in Settings.");
    return;
  }
  if (!settings.apiKey) {
    console.log("[Email] No API key configured.");
    return;
  }
  if (recipientEmails.length === 0) {
    console.log("[Email] No recipients configured for feedback notification.");
    return;
  }

  const transporter = await getEmailTransporter();
  if (!transporter) {
    console.log("[Email] Failed to create email transporter.");
    return;
  }

  const fromEmail = settings.fromEmail || "noreply@qatarliving.com";
  const fromName = settings.fromName || "Qatar Living Deals";
  const typeLabel = feedback.feedbackType === "mystery_shopper" ? "Mystery Shopper" : "Merchant Referral";
  const subject = `New ${typeLabel} Feedback Submission${feedback.shopperName ? ` - ${feedback.shopperName}` : ""}`;

  const rows: Array<[string, string]> = [
    ["Type", typeLabel],
    ["Name", feedback.shopperName || "—"],
    ["Merchant", feedback.merchantName || "—"],
    ["Location", feedback.merchantLocation || "—"],
    ["Date of Visit", feedback.visitDate || "—"],
    ["Time of Visit", feedback.visitTime || "—"],
    ...(feedback.feedbackType === "mystery_shopper"
      ? ([["Total Budget (QAR)", feedback.totalBudgetQar || "—"]] as Array<[string, string]>)
      : []),
    ["Submitted", new Date(feedback.createdAt).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })],
  ];

  const tableHtml = rows.map(([k, v]) => `
    <tr>
      <td style="padding: 8px 0; border-bottom: 1px solid #f3f4f6; font-weight: bold; color: #6b7280; width: 160px;">${k}:</td>
      <td style="padding: 8px 0; border-bottom: 1px solid #f3f4f6; color: #111827;">${v}</td>
    </tr>
  `).join("");

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"><title>New Feedback Submission</title></head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: #00426D; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
        <h1 style="color: white; margin: 0; font-size: 24px;">Qatar Living Deals</h1>
        <p style="color: rgba(255,255,255,0.8); margin: 5px 0 0 0; font-size: 14px;">New ${typeLabel} Feedback</p>
      </div>
      <div style="background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; border: 1px solid #e5e7eb; border-top: none;">
        <h2 style="color: #00426D; margin-top: 0; margin-bottom: 20px;">A new feedback has been submitted</h2>
        <div style="background: white; padding: 20px; border-radius: 8px; border: 1px solid #e5e7eb; margin-bottom: 25px;">
          <table style="width: 100%; border-collapse: collapse;">${tableHtml}</table>
        </div>
        <div style="text-align: center;">
          <a href="${DASHBOARD_URL}/admin/feedbacks/${feedback.id}"
             style="display: inline-block; background: #00426D; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px;">
            View Feedback
          </a>
        </div>
        <p style="color: #6b7280; font-size: 13px; margin-top: 25px; text-align: center;">
          This is an automated notification from Qatar Living Deals Admin Portal.
        </p>
      </div>
    </body>
    </html>
  `;

  const textContent = rows.map(([k, v]) => `${k}: ${v}`).join("\n") +
    `\n\nView Feedback: ${DASHBOARD_URL}/admin/feedbacks/${feedback.id}`;

  try {
    await transporter.sendMail({
      from: `"${fromName}" <${fromEmail}>`,
      to: recipientEmails.join(", "),
      subject,
      text: textContent,
      html: htmlContent,
    });
    console.log(`[Email] Feedback notification sent to ${recipientEmails.length} recipient(s)`);
  } catch (error) {
    console.error("[Email] Failed to send feedback notification:", error);
  }
}
