import { Resend } from "resend";

export async function sendApiKeyEmail(input: {
  to: string;
  customerName: string;
  productName: string;
  planName: string;
  apiKey: string;
  targetUrl: string;
}) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL || "Monapi <onboarding@resend.dev>";

  const curlSnippet = `curl -X GET "${input.targetUrl}" \\\n  -H "Authorization: Bearer ${input.apiKey}" \\\n  -H "Content-Type: application/json"`;

  if (!apiKey) {
    console.info("[email] RESEND_API_KEY missing — skipping send", {
      to: input.to,
      product: input.productName,
    });
    return { sent: false as const, curlSnippet };
  }

  const resend = new Resend(apiKey);

  try {
    await resend.emails.send({
      from,
      to: input.to,
      subject: `Your ${input.productName} API key is ready`,
      html: `
        <div style="font-family: ui-sans-serif, system-ui, sans-serif; line-height: 1.5; color: #0f172a;">
          <h1 style="font-size: 20px;">Welcome to ${input.productName}</h1>
          <p>Hi ${input.customerName || "there"},</p>
          <p>Your <strong>${input.planName}</strong> subscription is active. Here’s your API key:</p>
          <pre style="background:#0b1220;color:#e2e8f0;padding:16px;border-radius:8px;">${input.apiKey}</pre>
          <p>Quick start:</p>
          <pre style="background:#0b1220;color:#e2e8f0;padding:16px;border-radius:8px;white-space:pre-wrap;">${curlSnippet}</pre>
          <p style="color:#64748b;font-size:13px;">Powered by Monapi — the easiest way to sell your API in Africa.</p>
        </div>
      `,
    });
    return { sent: true as const, curlSnippet };
  } catch (error) {
    console.error("[email] failed to send", {
      message: error instanceof Error ? error.message : "unknown",
    });
    return { sent: false as const, curlSnippet };
  }
}
