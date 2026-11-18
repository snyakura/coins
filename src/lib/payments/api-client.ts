import { supabase } from "@/lib/supabase";

/** Browser -> OUR backend only. The Supabase session token is the only credential; no Deriv secrets exist client-side. */
export async function api<T = any>(path: string, init: { method?: string; json?: unknown; form?: FormData } = {}): Promise<T> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  const headers: Record<string, string> = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (init.json) headers['Content-Type'] = 'application/json';
  const req: RequestInit = { method: init.method ?? (init.json || init.form ? "POST" : "GET"), headers };
  if (init.form) req.body = init.form;
  else if (init.json) req.body = JSON.stringify(init.json);
  const res = await fetch(path, req);
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(j.error ?? "Something went wrong. Please try again."), { code: j.code as string | undefined });
  return j as T;
}

export const STATUS_LABEL: Record<string, { label: string; tone: "wait" | "ok" | "bad"; next?: string }> = {
  PENDING_PAYMENT: { label: "Pending payment", tone: "wait", next: "Send the payment, then upload your proof." },
  PAYMENT_SUBMITTED: { label: "Under review", tone: "wait", next: "We received your proof and will review it shortly." },
  UNDER_REVIEW: { label: "Under review", tone: "wait", next: "Our team is verifying your payment." },
  PAYMENT_VERIFIED: { label: "Processing", tone: "wait", next: "Payment verified. Sending to your Deriv account." },
  PROCESSING_DERIV: { label: "Processing", tone: "wait", next: "Deriv is processing the transfer. No action needed." },
  COMPLETED: { label: "Completed", tone: "ok" },
  FAILED: { label: "Failed", tone: "bad", next: "Please contact support with your reference." },
  REJECTED: { label: "Rejected", tone: "bad", next: "We couldn't verify your payment. Contact support." },
  CANCELLED: { label: "Cancelled", tone: "bad" },
  REQUESTED: { label: "Requested", tone: "wait", next: "Request your verification code to continue." },
  VERIFICATION_REQUIRED: { label: "Code required", tone: "wait", next: "Enter the 6-digit code sent to your Deriv contact." },
  VERIFIED: { label: "Processing", tone: "wait", next: "Submitting to Deriv." },
  PROCESSING: { label: "Processing", tone: "wait", next: "Deriv is processing your withdrawal." },
};

export const PAY_DETAILS: Record<string, string> = {
  Ecocash: "EcoCash: Marc Anthony Zhou, +263 78 429 3089",
  InnBucks: "InnBucks: Marc Anthony Zhou, +263 78 429 3089",
  "FNB BUSINESS ACCOUNT": "FNB Business Account: 63051409861",
};
