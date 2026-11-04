import nodemailer from "nodemailer";

class EmailService {
  #transporter;

  constructor() {
    this.#transporter = nodemailer.createTransport({
      service: "gmail",
      pool: true,
      maxConnections: 5,
      maxMessages: 100,
      secure: true,
      auth: {
        user: process.env.APP_EMAIL_ADDRESS,
        pass: process.env.APP_EMAIL_PASSWORD,
      },
    });
  }

  async sendEmail({ to, subject, html }) {
    await this.#transporter.sendMail({
      from: `"Dary" <${process.env.APP_EMAIL_ADDRESS}>`,
      to,
      subject,
      html,
    });
  }

  /**
   * Shared shell used by every email: navy/gold header with the
   * "Dary" wordmark, a gold divider, the content block, and the footer.
   *
   * @param {string} eyebrow  small uppercase label above the logo (e.g. "Account Activation")
   * @param {string} title    main heading inside the content block
   * @param {string} subtitle optional supporting line under the heading
   * @param {string} content  the email-specific HTML block
   */
  buildTemplate({ eyebrow = "", title, subtitle, content }) {
    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <title>Dary</title>
</head>
<body style="margin:0;padding:0;background:#EEF1F8;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
    <tr>
      <td align="center" style="padding:40px 16px;">
        <table width="600" cellpadding="0" cellspacing="0" role="presentation" style="background:#ffffff;border-radius:24px;overflow:hidden;box-shadow:0 20px 50px rgba(36,59,124,0.15);">

          <!-- Header -->
          <tr>
            <td style="background:#243B7C;background:linear-gradient(160deg,#243B7C 0%,#16244F 100%);padding:44px 30px 30px;text-align:center;">
              ${
                eyebrow
                  ? `<div style="font-size:11px;letter-spacing:3px;color:#EFE2C8;text-transform:uppercase;font-weight:bold;">&#9679;&nbsp; ${eyebrow}</div>`
                  : ""
              }
              <div style="font-size:40px;font-weight:800;color:#ffffff;margin-top:12px;letter-spacing:.5px;">
                D<span style="color:#C8A96A;">ary</span>
              </div>
              <div style="margin-top:8px;font-size:14px;color:rgba(255,255,255,.75);">
                Your key to the perfect home
              </div>
            </td>
          </tr>

          <!-- Gold divider -->
          <tr>
            <td style="height:5px;line-height:5px;font-size:0;background:#C8A96A;background:linear-gradient(90deg,#C8A96A 0%,#EFE2C8 50%,#C8A96A 100%);">&nbsp;</td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding:44px 42px;text-align:center;">
              <h2 style="margin:0;font-size:26px;color:#243B7C;font-family:Arial,Helvetica,sans-serif;">${title}</h2>
              <div style="width:36px;height:3px;background:#C8A96A;margin:14px auto 0;border-radius:3px;font-size:0;line-height:0;">&nbsp;</div>

              ${
                subtitle
                  ? `<p style="margin:18px 0 0;color:#767C8C;font-size:15px;line-height:1.8;">${subtitle}</p>`
                  : ""
              }

              ${content}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#FAF7F2;padding:24px;text-align:center;border-top:1px solid #EFE7D8;">
              <p style="margin:0;font-size:12px;color:#767C8C;">
                &copy; ${new Date().getFullYear()} <strong style="color:#243B7C;">Dary</strong>. All rights reserved.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
  }

  async sendOtpEmail({ to, otp, subject }) {
    const html = this.buildTemplate({
      eyebrow: "Account Activation",
      title: "Verify Your Email",
      subtitle:
        "Welcome to Dary 👋 Enter the verification code below to activate your account.",
      content: `
        <table cellpadding="0" cellspacing="0" role="presentation" style="margin:34px auto 0;">
          <tr>
            <td align="center">
              <div style="width:22px;height:22px;border-radius:50%;background:#ffffff;border:3px solid #C8A96A;margin:0 auto;box-shadow:0 3px 6px rgba(36,59,124,0.12);"></div>
            </td>
          </tr>
          <tr>
            <td style="background:#FAF7F2;border:1.5px dashed #C8A96A;border-radius:16px;padding:22px 40px;margin-top:-11px;">
              <div style="font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#C8A96A;font-weight:bold;text-align:center;">
                Verification Code
              </div>
              <div style="margin-top:10px;font-size:36px;font-weight:bold;letter-spacing:9px;color:#243B7C;font-family:'Courier New',monospace;text-align:center;">
                ${otp}
              </div>
            </td>
          </tr>
        </table>

        <p style="margin-top:20px;color:#767C8C;font-size:13px;">
          This code expires in <strong style="color:#243B7C;">2 minutes</strong>.
        </p>

        <table cellpadding="0" cellspacing="0" role="presentation" width="100%" style="margin-top:26px;">
          <tr>
            <td style="background:#F6F8FD;border-left:3px solid #C8A96A;border-radius:10px;padding:16px 18px;text-align:left;">
              <p style="margin:0;font-size:13px;color:#767C8C;line-height:1.7;">
                🔒 For your security, never share this code with anyone. The Dary team will never ask for your verification code by phone or email.
              </p>
            </td>
          </tr>
        </table>
      `,
    });

    return this.sendEmail({
      to,
      subject: subject || "Dary | Email Verification",
      html,
    });
  }

  async sendOtpSuccessEmail({ to }) {
    const html = this.buildTemplate({
      eyebrow: "Account Verified",
      title: "Account Verified 🎉",
      subtitle:
        "Congratulations! Your Dary account has been verified successfully.",
      content: `
        <table cellpadding="0" cellspacing="0" role="presentation" style="margin:32px auto 0;">
          <tr>
            <td style="background:#243B7C;border-radius:12px;padding:18px 34px;">
              <p style="margin:0;color:#ffffff;font-size:16px;font-weight:bold;text-align:center;">
                Your account is now ready.
              </p>
            </td>
          </tr>
        </table>

        <p style="margin-top:24px;color:#767C8C;font-size:15px;line-height:1.8;">
          You can now enjoy all Dary features and start exploring available properties.
        </p>
      `,
    });

    return this.sendEmail({
      to,
      subject: "Dary | Account Verified",
      html,
    });
  }

  async sendWelcomeAfterLogin({ to, subject }) {
    const html = this.buildTemplate({
      eyebrow: "Login Notification",
      title: "Welcome Back 👋",
      subtitle: "You have successfully signed in to your Dary account.",
      content: `
        <table cellpadding="0" cellspacing="0" role="presentation" width="100%" style="margin-top:30px;">
          <tr>
            <td style="background:#FAF7F2;border-radius:12px;padding:22px;text-align:center;">
              <p style="margin:0;font-size:16px;color:#243B7C;font-weight:bold;">
                We're happy to see you again.
              </p>
            </td>
          </tr>
        </table>
      `,
    });

    return this.sendEmail({
      to,
      subject: subject || "Dary | Login Notification",
      html,
    });
  }

  async sendResetPasswordEmail(to, link) {
    const html = this.buildTemplate({
      eyebrow: "Password Reset",
      title: "Reset Your Password",
      subtitle:
        "Click the button below to create a new password for your Dary account.",
      content: `
        <table cellpadding="0" cellspacing="0" role="presentation" style="margin:34px auto 0;">
          <tr>
            <td style="border-radius:10px;background:#243B7C;">
              <a href="${link}" style="display:inline-block;padding:16px 34px;color:#ffffff;text-decoration:none;font-size:16px;font-weight:bold;">
                Reset Password
              </a>
            </td>
          </tr>
        </table>

        <p style="margin-top:30px;color:#a3a8b4;font-size:13px;">
          If you didn't request a password reset, you can safely ignore this email.
        </p>
      `,
    });

    return this.sendEmail({
      to,
      subject: "Dary | Reset Password",
      html,
    });
  }

  async notificationNewEvent({ to, subject, title, body }) {
    const html = this.buildTemplate({
      eyebrow: "Notification",
      title: title || "New Notification",
      subtitle: "You have received a new notification from Dary.",
      content: `
        <table cellpadding="0" cellspacing="0" role="presentation" width="100%" style="margin-top:26px;">
          <tr>
            <td style="background:#FAF7F2;border-left:5px solid #C8A96A;border-radius:10px;padding:20px 22px;text-align:left;">
              <h3 style="margin:0 0 8px;color:#243B7C;font-size:17px;">${title}</h3>
              <p style="margin:0;color:#555;font-size:15px;line-height:1.8;">
                ${body}
              </p>
            </td>
          </tr>
        </table>
      `,
    });

    await this.sendEmail({
      to,
      subject: subject || "Dary | Notification",
      html,
    });

    return { to, subject, title };
  }
}

export { EmailService };

export default new EmailService();