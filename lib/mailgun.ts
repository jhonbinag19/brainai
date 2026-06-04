// Mailgun SMTP configuration
const SMTP_HOST = process.env.SMTP_HOST || 'smtp.mailgun.org';
const SMTP_PORT = parseInt(process.env.SMTP_PORT || '587');
const SMTP_USER = process.env.SMTP_USER || 'postmaster@noreply.rapidactivemarketing.com';
const SMTP_PASS = process.env.SMTP_PASS || '';
const MAILGUN_FROM = process.env.MAILGUN_FROM || 'Automated Marketer <nunoai@noreply.rapidactivemarketing.com>';

export interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

// Simple SMTP send function (using Node.js built-in net)
async function sendSMTP(to: string, subject: string, html: string, text: string): Promise<boolean> {
  try {
    // Boundary for multipart
    const boundary = `----=_Part_${Date.now()}.${Math.random().toString(36).substr(2, 9)}`;

    const emailBody = [
      `From: ${MAILGUN_FROM}`,
      `To: ${to}`,
      `Subject: ${subject}`,
      `MIME-Version: 1.0`,
      `Content-Type: multipart/alternative; boundary="${boundary}"`,
      '',
      `--${boundary}`,
      `Content-Type: text/plain; charset=UTF-8`,
      'Content-Transfer-Encoding: 7bit',
      '',
      text || 'This is a HTML email. Please view in a client that supports HTML.',
      '',
      `--${boundary}`,
      `Content-Type: text/html; charset=UTF-8`,
      'Content-Transfer-Encoding: 7bit',
      '',
      html,
      '',
      `--${boundary}--`,
      '',
    ].join('\r\n');

    const authString = Buffer.from(`\0${SMTP_USER}\0${SMTP_PASS}`).toString('base64');

    const socket = await import('net').then(m => {
      return new Promise<any>((resolve, reject) => {
        const client = new m.Socket();
        client.connect(SMTP_PORT, SMTP_HOST, () => {
          resolve(client);
        });
        client.on('error', reject);
        setTimeout(() => reject(new Error('SMTP connection timeout')), 10000);
      });
    });

    // Simple SMTP commands
    await smtpConversation(socket, [
      `EHLO nunoai.vercel.app\r\n`,
      `AUTH PLAIN ${authString}\r\n`,
      `MAIL FROM:<${MAILGUN_FROM.match(/<(.+)>/)?.[1] || SMTP_USER}>\r\n`,
      `RCPT TO:<${to}>\r\n`,
      `DATA\r\n`,
    ]);

    // Send email body
    socket.write(emailBody + '\r\n.\r\n');

    // Wait for response
    await waitForCode(socket, 250);

    socket.end();

    return true;
  } catch (error) {
    console.error('SMTP error:', error);
    return false;
  }
}

function smtpConversation(socket: any, commands: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    let index = 0;

    socket.on('data', (data: Buffer) => {
      const response = data.toString();
      const code = parseInt(response.substring(0, 3));

      if (code >= 400) {
        reject(new Error(`SMTP error: ${response}`));
        return;
      }

      if (index < commands.length) {
        socket.write(commands[index++]);
      } else {
        resolve();
      }
    });

    // Start conversation
    socket.write(commands[index++]);
  });
}

function waitForCode(socket: any, expectedCode: number): Promise<void> {
  return new Promise((resolve, reject) => {
    socket.once('data', (data: Buffer) => {
      const response = data.toString();
      const code = parseInt(response.substring(0, 3));
      if (code === expectedCode) {
        resolve();
      } else {
        reject(new Error(`Expected ${expectedCode}, got ${code}: ${response}`));
      }
    });
  });
}

export async function sendEmail({ to, subject, html, text }: SendEmailParams): Promise<boolean> {
  try {
    // Use fetch to Mailgun API as fallback (simpler and more reliable)
    const API_KEY = process.env.MAILGUN_API_KEY || '';
    const DOMAIN = process.env.MAILGUN_DOMAIN || 'noreply.rapidactivemarketing.com';

    if (API_KEY && API_KEY.startsWith('key-')) {
      const formData = new URLSearchParams();
      formData.append('from', MAILGUN_FROM);
      formData.append('to', to);
      formData.append('subject', subject);
      formData.append('html', html);
      if (text) formData.append('text', text);

      const response = await fetch(
        `https://api.mailgun.net/v3/${DOMAIN}/messages`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Basic ${btoa(`api:${API_KEY}`)}`,
          },
          body: formData,
        }
      );

      if (!response.ok) {
        const error = await response.text();
        console.error('Mailgun API error:', error);
        return false;
      }

      return true;
    } else {
      // Try SMTP if API key not available
      return await sendSMTP(to, subject, html, text || '');
    }
  } catch (error) {
    console.error('Email send error:', error);
    return false;
  }
}

export async function sendConfirmationEmail(email: string, confirmUrl: string): Promise<boolean> {
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Confirm Your Account</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; background: #f5f5f5; padding: 20px; }
          .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; overflow: hidden; }
          .header { background: linear-gradient(135deg, #7c3aed 0%, #5b21b6 100%); color: white; padding: 30px; text-align: center; }
          .header h1 { margin: 0; font-size: 24px; }
          .content { padding: 40px 30px; }
          .content h2 { color: #1f2937; margin-top: 0; }
          .content p { color: #6b7280; margin-bottom: 20px; }
          .button-container { text-align: center; margin: 30px 0; }
          .button { display: inline-block; background: linear-gradient(135deg, #7c3aed 0%, #5b21b6 100%); color: white; padding: 14px 32px; text-decoration: none; border-radius: 6px; font-weight: 600; box-shadow: 0 4px 6px rgba(124, 58, 237, 0.3); }
          .button:hover { box-shadow: 0 6px 8px rgba(124, 58, 237, 0.4); }
          .link-text { color: #7c3aed; word-break: break-all; font-size: 14px; }
          .footer { background: #f9fafb; padding: 20px 30px; text-align: center; font-size: 12px; color: #9ca3af; border-top: 1px solid #e5e7eb; }
          .footer p { margin: 0; }
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

            <p style="background: #f3f4f6; padding: 15px; border-radius: 6px; border-left: 4px solid #7c3aed;">
              <strong>Email:</strong> ${email}
            </p>

            <div class="button-container">
              <a href="${confirmUrl}" class="button">Confirm Email Address</a>
            </div>

            <p style="font-size: 14px;">Or copy and paste this link into your browser:</p>
            <p class="link-text">${confirmUrl}</p>

            <p style="font-size: 12px; color: #9ca3af; margin-top: 30px; padding: 15px; background: #fffbeb; border-radius: 6px; border: 1px solid #fcd34d;">
              ⚠️ This link will expire in 24 hours. If you didn't create an account, please ignore this email.
            </p>
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
