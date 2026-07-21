import { Resend } from "resend";
import type { EmailPreview } from "@/lib/types";
import { buildGatewayCurl } from "@/lib/utils";

export function buildApiKeyEmailHtml(input: {
  customerName: string;
  productName: string;
  planName: string;
  apiKey: string;
  curlSnippet: string;
}) {
  return `
        <div style="font-family: ui-sans-serif, system-ui, sans-serif; line-height: 1.5; color: #0f172a;">
          <h1 style="font-size: 20px; color: #0f172a; margin: 0 0 12px;">Welcome to ${input.productName}</h1>
          <p style="color: #334155; margin: 0 0 8px;">Hi ${input.customerName || "there"},</p>
          <p style="color: #334155; margin: 0 0 12px;">Your <strong style="color: #0f172a;">${input.planName}</strong> subscription is active. Here's your API key:</p>
          <pre style="background:#0b1220;color:#e2e8f0;padding:16px;border-radius:8px;overflow-x:auto;">${input.apiKey}</pre>
          <p style="color: #334155; margin: 16px 0 8px;">Quick start:</p>
          <pre style="background:#0b1220;color:#e2e8f0;padding:16px;border-radius:8px;white-space:pre-wrap;overflow-x:auto;">${input.curlSnippet}</pre>
          <p style="color:#64748b;font-size:13px;margin:16px 0 0;">Powered by Monapi — the easiest way to sell your API in Africa.</p>
        </div>
      `;
}

export async function sendApiKeyEmail(input: {
  to: string;
  customerName: string;
  productName: string;
  planName: string;
  apiKey: string;
  productSlug: string;
  origin: string;
  /** Demo mode: never call Resend. */
  offline?: boolean;
}) {
  const resendKey = process.env.RESEND_API_KEY;
  const from =
    process.env.RESEND_FROM_EMAIL || "Monapi <onboarding@resend.dev>";
  const subject = `Your ${input.productName} API key is ready`;

  const curlSnippet = buildGatewayCurl(
    input.origin,
    input.productSlug,
    input.apiKey,
  );
  const html = buildApiKeyEmailHtml({
    customerName: input.customerName,
    productName: input.productName,
    planName: input.planName,
    apiKey: input.apiKey,
    curlSnippet,
  });

  const preview: EmailPreview = {
    to: input.to,
    subject,
    html,
    sent: false,
  };

  if (input.offline || !resendKey) {
    console.info(
      input.offline
        ? "[email] demo/offline — skipping Resend"
        : "[email] RESEND_API_KEY missing — skipping send",
      {
        to: input.to,
        product: input.productName,
      },
    );
    return { sent: false as const, curlSnippet, preview };
  }

  const resend = new Resend(resendKey);

  try {
    await resend.emails.send({
      from,
      to: input.to,
      subject,
      html,
    });
    preview.sent = true;
    return { sent: true as const, curlSnippet, preview };
  } catch (error) {
    console.error("[email] failed to send", {
      message: error instanceof Error ? error.message : "unknown",
    });
    return { sent: false as const, curlSnippet, preview };
  }
}
