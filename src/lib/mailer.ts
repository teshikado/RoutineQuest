import nodemailer from "nodemailer";

/**
 * Sends via real SMTP when SMTP_HOST is configured. Otherwise falls back to logging
 * the email to the server console so auth flows (password reset) stay fully testable
 * without any external email provider configured.
 */
export async function sendMail(to: string, subject: string, text: string, html?: string) {
  if (process.env.SMTP_HOST) {
    const transport = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT ?? 587),
      secure: process.env.SMTP_SECURE === "true",
      auth: process.env.SMTP_USER
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
        : undefined,
    });
    await transport.sendMail({
      from: process.env.SMTP_FROM ?? "RoutineQuest <no-reply@routinequest.app>",
      to,
      subject,
      text,
      html,
    });
    return;
  }

  console.log("\n===== [RoutineQuest] E-Mail (kein SMTP konfiguriert, nur Konsolen-Ausgabe) =====");
  console.log(`An: ${to}`);
  console.log(`Betreff: ${subject}`);
  console.log(text);
  console.log("================================================================================\n");
}
