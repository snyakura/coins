// Server-side only. Never import this from a component or route loader that runs in the browser.
export type DerivConfig = {
  mock: boolean;
  appId: string;
  clientId: string;
  agentToken: string;
  agentId: number;
  apiBaseUrl: string;
  authBaseUrl: string;
  redirectUri: string;
};

export function loadDerivConfig(env: Record<string, string | undefined> = process.env): DerivConfig {
  const mock = (env.DERIV_MOCK_MODE ?? "true").toLowerCase() !== "false";
  const cfg: DerivConfig = {
    mock,
    appId: env.DERIV_APP_ID ?? "",
    clientId: env.DERIV_CLIENT_ID ?? "",
    agentToken: env.DERIV_AGENT_TOKEN ?? "",
    agentId: Number(env.DERIV_AGENT_ID ?? 0),
    apiBaseUrl: (env.DERIV_API_BASE_URL || "https://api.derivws.com").replace(/\/$/, ""),
    authBaseUrl: (env.DERIV_AUTH_BASE_URL || "https://auth.deriv.com").replace(/\/$/, ""),
    redirectUri: env.DERIV_OAUTH_REDIRECT_URI ?? "",
  };
  if (!mock) {
    const missing: string[] = (
      [["DERIV_APP_ID", cfg.appId], ["DERIV_CLIENT_ID", cfg.clientId], ["DERIV_AGENT_TOKEN", cfg.agentToken],
       ["DERIV_OAUTH_REDIRECT_URI", cfg.redirectUri]] as const
    ).filter(([, v]) => !v).map(([k]) => k);
    if (!(cfg.agentId >= 1)) missing.push("DERIV_AGENT_ID");
    if (missing.length) throw new Error(`Deriv real mode needs: ${missing.join(", ")}`);
  }
  return cfg;
}
