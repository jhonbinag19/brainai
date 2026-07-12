// Mailgun email configuration for Vercel deployment
// On Vercel serverless, we use Mailgun REST API instead of raw SMTP for better reliability

const MAILGUN_API_KEY = process.env.MAILGUN_API_KEY || '';
const MAILGUN_DOMAIN = process.env.MAILGUN_DOMAIN || 'noreply.rapidactivemarketing.com';
const MAILGUN_FROM = process.env.MAILGUN_FROM || 'Nuno AI <nunoai@noreply.rapidactivemarketing.com>';

export interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

/**
 * Send email using Mailgun REST API (recommended for Vercel serverless)
 * This is more reliable than raw SMTP in serverless environments
 */
async function sendViaMailgunAPI(
  to: string,
  subject: string,
  html: string,
  text?: string
): Promise<boolean> {
  try {
    if (!MAILGUN_API_KEY) {
      console.error('MAILGUN_API_KEY not configured');
      return false;
    }

    // Use FormData for proper multipart/form-data handling
    const formData = new FormData();
    formData.append('from', MAILGUN_FROM);
    formData.append('to', to);
    formData.append('subject', subject);
    formData.append('html', html);
    if (text) formData.append('text', text);

    const response = await fetch(
      `https://api.mailgun.net/v3/${MAILGUN_DOMAIN}/messages`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${btoa(`api:${MAILGUN_API_KEY}`)}`,
        },
        body: formData,
      }
    );

    if (!response.ok) {
      const error = await response.text();
      console.error('Mailgun API error:', response.status, error);
      return false;
    }

    const result = await response.json();
    console.log('Email sent successfully via Mailgun API:', result.id);
    return true;
  } catch (error) {
    console.error('Mailgun API request error:', error);
    return false;
  }
}

/**
 * Send email function - automatically selects the best method for the environment
 * - Vercel/Serverless: Uses Mailgun REST API
 * - Other environments with proper SMTP libraries: Could use SMTP
 */
export async function sendEmail({ to, subject, html, text }: SendEmailParams): Promise<boolean> {
  // On Vercel, always use Mailgun API for reliability
  // Raw SMTP with net.Socket doesn't work well in serverless environments
  return sendViaMailgunAPI(to, subject, html, text);
}

/**
 * Send confirmation email for new user signup
 */
export async function sendConfirmationEmail(email: string, confirmUrl: string): Promise<boolean> {
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Confirm Your Account</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #333; background: #f5f5f5; padding: 20px; margin: 0; }
          .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
          .header { background: linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%); color: white; padding: 30px; text-align: center; }
          .header h1 { margin: 0; font-size: 24px; font-weight: 600; }
          .content { padding: 40px 30px; }
          .content h2 { color: #1f2937; margin-top: 0; font-size: 20px; }
          .content p { color: #6b7280; margin-bottom: 20px; line-height: 1.6; }
          .info-box { background: #f3f4f6; padding: 15px; border-radius: 6px; border-left: 4px solid #7c3aed; margin: 20px 0; }
          .info-box strong { color: #1f2937; }
          .button-container { text-align: center; margin: 30px 0; }
          .button { display: inline-block; background: linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%); color: #ffffff !important; padding: 14px 32px; text-decoration: none; border-radius: 6px; font-weight: 600; box-shadow: 0 4px 6px rgba(124, 58, 237, 0.3); transition: all 0.2s ease; }
          .button:hover { box-shadow: 0 6px 8px rgba(124, 58, 237, 0.4); transform: translateY(-1px); }
          .button a { color: #ffffff !important; text-decoration: none; }
          .button a:link { color: #ffffff !important; }
          .button a:visited { color: #ffffff !important; }
          .button a:hover { color: #ffffff !important; }
          .button a:active { color: #ffffff !important; }
          .link-text { color: #7c3aed; word-break: break-all; font-size: 14px; line-height: 1.5; }
          .footer { background: #f9fafb; padding: 20px 30px; text-align: center; font-size: 12px; color: #9ca3af; border-top: 1px solid #e5e7eb; }
          .footer p { margin: 0; }
          .warning { font-size: 12px; color: #9ca3af; margin-top: 30px; padding: 15px; background: #fffbeb; border-radius: 6px; border: 1px solid #fcd34d; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Nuno AI</h1>
          </div>
          <div class="content">
            <h2>Confirm Your Account</h2>
            <p>Welcome! Thank you for signing up for Nuno AI. Please confirm your email address to activate your account and start using our service.</p>

            <div class="info-box">
              <strong>Email:</strong> ${email}
            </div>

            <div class="button-container">
              <a href="${confirmUrl}" class="button" style="color: #ffffff !important; text-decoration: none;">Confirm Email Address</a>
            </div>

            <p style="font-size: 14px; color: #6b7280;">Or copy and paste this link into your browser:</p>
            <p class="link-text">${confirmUrl}</p>

            <div class="warning">
              ⚠️ This link will expire in 24 hours. If you didn't create an account, please ignore this email.
            </div>
          </div>
          <div class="footer">
            <p>Powered by Nuno AI • RapidActive Marketing</p>
            <p style="margin-top: 8px;">© 2026 All rights reserved</p>
          </div>
        </div>
      </body>
    </html>
  `;

  return sendEmail({
    to: email,
    subject: 'Confirm Your Nuno AI Account',
    html,
    text: `Confirm your Nuno AI account by visiting: ${confirmUrl}`,
  });
}

/**
 * Send password reset email
 */
export async function sendPasswordResetEmail(email: string, resetUrl: string): Promise<boolean> {
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Reset Your Password</title>
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #333; background: #f5f5f5; padding: 20px; margin: 0;">
        <table role="presentation" cellpadding="0" cellspacing="0" style="max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%); color: white; padding: 30px; text-align: center;">
              <h1 style="margin: 0; font-size: 24px; font-weight: 600; color: #ffffff;">Nuno AI</h1>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 40px 30px;">
              <h2 style="color: #1f2937; margin-top: 0; font-size: 20px;">Reset Your Password</h2>
              <p style="color: #6b7280; margin-bottom: 20px; line-height: 1.6;">We received a request to reset your password for your Nuno AI account. Click the button below to create a new password.</p>

              <!-- Email Info Box -->
              <table role="presentation" cellpadding="0" cellspacing="0" style="background: #f3f4f6; padding: 15px; border-radius: 6px; border-left: 4px solid #7c3aed; margin: 20px 0;">
                <tr>
                  <td style="color: #1f2937;">
                    <strong>Email:</strong> ${email}
                  </td>
                </tr>
              </table>

              <!-- Button -->
              <table role="presentation" cellpadding="0" cellspacing="0" style="margin: 30px 0; text-align: center;">
                <tr>
                  <td style="text-align: center;">
                    <a href="${resetUrl}" style="display: inline-block; background: linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%); color: #ffffff; padding: 16px 40px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 6px rgba(124, 58, 237, 0.3);">Reset Password</a>
                  </td>
                </tr>
              </table>

              <p style="font-size: 14px; color: #6b7280;">Or copy and paste this link into your browser:</p>
              <p style="color: #7c3aed; word-break: break-all; font-size: 14px; line-height: 1.5; margin: 0;">${resetUrl}</p>

              <!-- Warning -->
              <table role="presentation" cellpadding="0" cellspacing="0" style="margin-top: 30px; padding: 15px; background: #fffbeb; border-radius: 6px; border: 1px solid #fcd34d;">
                <tr>
                  <td style="font-size: 12px; color: #9ca3af;">
                    ⚠️ This link will expire in 1 hour. If you didn't request a password reset, please ignore this email.
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background: #f9fafb; padding: 20px 30px; text-align: center; font-size: 12px; color: #9ca3af; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0;">Powered by Nuno AI • RapidActive Marketing</p>
              <p style="margin: 8px 0 0 0;">© 2026 All rights reserved</p>
            </td>
          </tr>
        </table>
      </body>
    </html>
  `;

  return sendEmail({
    to: email,
    subject: 'Reset Your Nuno AI Password',
    html,
    text: `Reset your Nuno AI password by visiting: ${resetUrl}`,
  });
}

