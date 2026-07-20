import { createHmac, timingSafeEqual } from "crypto";

const DEFAULT_MONNIFY_BASE = "https://sandbox.monnify.com/api/v1";

type MonnifyTokenResponse = {
  requestSuccessful?: boolean;
  responseBody?: { accessToken?: string; expiresIn?: number };
  responseMessage?: string;
};

type MonnifyInitResponse = {
  requestSuccessful?: boolean;
  responseMessage?: string;
  responseBody?: {
    checkoutUrl?: string;
    transactionReference?: string;
    paymentReference?: string;
  };
};

let cachedToken: { value: string; expiresAt: number } | null = null;

function getCredentials() {
  const apiKey = process.env.MONNIFY_API_KEY?.trim();
  const secretKey = process.env.MONNIFY_SECRET_KEY?.trim();
  const contractCode = process.env.MONNIFY_CONTRACT_CODE?.trim();

  if (!apiKey || !secretKey || !contractCode) {
    return null;
  }

  return { apiKey, secretKey, contractCode };
}

function monnifyBaseUrl() {
  const raw = (process.env.MONNIFY_BASE_URL ?? DEFAULT_MONNIFY_BASE).trim();
  return raw.replace(/\/+$/, "");
}

export function isMonnifyConfigured() {
  return getCredentials() !== null;
}

export async function getMonnifyAccessToken(): Promise<string> {
  const creds = getCredentials();
  if (!creds) {
    throw new Error("Monnify credentials are not configured");
  }

  if (cachedToken && cachedToken.expiresAt > Date.now() + 30_000) {
    return cachedToken.value;
  }

  const basic = Buffer.from(`${creds.apiKey}:${creds.secretKey}`).toString(
    "base64",
  );

  const res = await fetch(`${monnifyBaseUrl()}/auth/login`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
  });

  const data = (await res.json().catch(() => ({}))) as MonnifyTokenResponse;

  if (!res.ok || !data.responseBody?.accessToken) {
    console.error("[monnify] auth failed", {
      status: res.status,
      message: data.responseMessage ?? "Unknown auth error",
      hasApiKey: Boolean(creds.apiKey),
      hasSecret: Boolean(creds.secretKey),
      hasContract: Boolean(creds.contractCode),
      base: monnifyBaseUrl(),
    });
    throw new Error(
      data.responseMessage
        ? `Monnify auth failed: ${data.responseMessage}`
        : "Failed to authenticate with Monnify Sandbox — check MONNIFY_API_KEY / MONNIFY_SECRET_KEY on Vercel",
    );
  }

  const expiresIn = data.responseBody.expiresIn ?? 3500;
  cachedToken = {
    value: data.responseBody.accessToken,
    expiresAt: Date.now() + expiresIn * 1000,
  };

  return cachedToken.value;
}

export type InitTransactionInput = {
  amount: number;
  customerName: string;
  customerEmail: string;
  paymentReference: string;
  paymentDescription: string;
  redirectUrl: string;
};

export async function initializeMonnifyTransaction(
  input: InitTransactionInput,
) {
  const creds = getCredentials();
  if (!creds) {
    throw new Error("Monnify credentials are not configured");
  }

  const token = await getMonnifyAccessToken();

  const payload = {
    amount: input.amount,
    customerName: input.customerName,
    customerEmail: input.customerEmail,
    paymentReference: input.paymentReference,
    paymentDescription: input.paymentDescription,
    currencyCode: "NGN",
    contractCode: creds.contractCode,
    redirectUrl: input.redirectUrl,
    paymentMethods: ["CARD", "ACCOUNT_TRANSFER"],
  };

  const res = await fetch(
    `${monnifyBaseUrl()}/merchant/transactions/init-transaction`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    },
  );

  let data: MonnifyInitResponse = {};
  try {
    data = (await res.json()) as MonnifyInitResponse;
  } catch {
    console.error("[monnify] init-transaction returned non-JSON response", {
      status: res.status,
    });
    throw new Error("Monnify returned an unexpected response format");
  }

  if (!res.ok || !data.requestSuccessful || !data.responseBody?.checkoutUrl) {
    console.error("[monnify] init-transaction failed", {
      status: res.status,
      message: data.responseMessage ?? "Unexpected Monnify error",
      hasCheckoutUrl: Boolean(data.responseBody?.checkoutUrl),
    });
    throw new Error(
      data.responseMessage ?? "Failed to initialize Monnify checkout",
    );
  }

  return {
    checkoutUrl: data.responseBody.checkoutUrl,
    transactionReference: data.responseBody.transactionReference ?? null,
    paymentReference:
      data.responseBody.paymentReference ?? input.paymentReference,
  };
}

/**
 * Monnify webhook signature: SHA-512 HMAC of the concatenated
 * paymentReference|amountPaid|paidOn|transactionReference using client secret.
 * Some payloads also ship a precomputed `transactionHash`.
 */
export function verifyMonnifySignature(
  payload: Record<string, unknown>,
  providedHash?: string | null,
): boolean {
  const secret = process.env.MONNIFY_SECRET_KEY?.trim();
  if (!secret) return false;

  const eventData = (payload.eventData ?? payload) as Record<string, unknown>;
  const paymentReference = String(
    eventData.paymentReference ?? payload.paymentReference ?? "",
  );
  const amountPaid = String(eventData.amountPaid ?? payload.amountPaid ?? "");
  const paidOn = String(eventData.paidOn ?? payload.paidOn ?? "");
  const transactionReference = String(
    eventData.transactionReference ?? payload.transactionReference ?? "",
  );

  const hashSource =
    providedHash ??
    String(eventData.transactionHash ?? payload.transactionHash ?? "");

  if (!paymentReference || !hashSource) {
    console.error("[monnify] signature check missing fields");
    return false;
  }

  const computed = createHmac("sha512", secret)
    .update(
      `${paymentReference}|${amountPaid}|${paidOn}|${transactionReference}`,
    )
    .digest("hex");

  try {
    return timingSafeEqual(Buffer.from(computed), Buffer.from(hashSource));
  } catch {
    return computed === hashSource;
  }
}

type MonnifyQueryResponse = {
  requestSuccessful?: boolean;
  responseMessage?: string;
  responseBody?: {
    paymentStatus?: string;
    paymentReference?: string;
    transactionReference?: string;
    amountPaid?: number | string;
    paidOn?: string;
    customer?: { email?: string; name?: string };
    customerEmail?: string;
    customerName?: string;
  };
};

/** Query Monnify for a transaction by our paymentReference (local webhook fallback). */
export async function queryMonnifyTransaction(paymentReference: string) {
  const token = await getMonnifyAccessToken();
  const url = new URL(`${monnifyBaseUrl()}/merchant/transactions/query`);
  url.searchParams.set("paymentReference", paymentReference);

  const res = await fetch(url.toString(), {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });

  let data: MonnifyQueryResponse = {};
  try {
    data = (await res.json()) as MonnifyQueryResponse;
  } catch {
    console.error("[monnify] query returned non-JSON", { status: res.status });
    throw new Error("Monnify query returned an unexpected response format");
  }

  if (!res.ok || !data.requestSuccessful || !data.responseBody) {
    console.error("[monnify] query failed", {
      status: res.status,
      message: data.responseMessage ?? "Unexpected Monnify query error",
    });
    throw new Error(
      data.responseMessage ?? "Failed to query Monnify transaction",
    );
  }

  const body = data.responseBody;
  return {
    status: String(body.paymentStatus ?? "").toUpperCase(),
    paymentReference: String(body.paymentReference ?? paymentReference),
    transactionReference: String(body.transactionReference ?? ""),
    amountPaid: Number(body.amountPaid ?? 0),
    paidOn: String(body.paidOn ?? ""),
    customerEmail: String(body.customer?.email ?? body.customerEmail ?? ""),
    customerName: String(body.customer?.name ?? body.customerName ?? ""),
  };
}

export function extractMonnifyPaymentStatus(payload: Record<string, unknown>) {
  const eventData = (payload.eventData ?? payload) as Record<string, unknown>;
  const status = String(
    eventData.paymentStatus ??
      eventData.transactionStatus ??
      payload.paymentStatus ??
      "",
  ).toUpperCase();

  return {
    status,
    paymentReference: String(
      eventData.paymentReference ?? payload.paymentReference ?? "",
    ),
    transactionReference: String(
      eventData.transactionReference ?? payload.transactionReference ?? "",
    ),
    customerEmail: String(
      (eventData.customer as { email?: string } | undefined)?.email ??
        eventData.customerEmail ??
        payload.customerEmail ??
        "",
    ),
    customerName: String(
      (eventData.customer as { name?: string } | undefined)?.name ??
        eventData.customerName ??
        payload.customerName ??
        "",
    ),
    amountPaid: Number(eventData.amountPaid ?? payload.amountPaid ?? 0),
  };
}
