import { DerivClient } from "./client";
import { loadDerivConfig, type DerivConfig } from "./config";
import { MockDeriv } from "./mock";
import type { DerivProvider } from "./types";

let cached: { cfg: DerivConfig; provider: DerivProvider } | null = null;

/** Picks the mock or the real client from DERIV_MOCK_MODE. The mock is a separate class; no shared code paths. */
export function getDeriv() {
  if (!cached) {
    const cfg = loadDerivConfig();
    cached = { cfg, provider: cfg.mock ? new MockDeriv() : new DerivClient(cfg) };
  }
  return cached;
}
export * from "./types";
