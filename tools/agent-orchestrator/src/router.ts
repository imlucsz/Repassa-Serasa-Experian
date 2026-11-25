// Provider/model resolution against the owner-approved policy list.
// Fail-closed rules:
//   * billing "unknown" is never callable, under any profile.
//   * billing "paid" requires an EXPLICIT model/provider selection AND a
//     routing profile that lists "paid" - automatic routing never picks paid.
//   * billing "free" is an owner declaration, not a gateway-verified fact;
//     pair it with provider.maxDailyCostUsd for a hard cap.
import type { OrchestratorConfig, ProviderDecl, Role } from './config.js';

export interface SelectedModel {
  provider: ProviderDecl;
  model: string;
}

const modelSatisfies = (role: Role, m: { capabilities: string[] }) =>
  role.capabilities.every((c) => m.capabilities.includes(c));

export function selectModel(
  cfg: OrchestratorConfig,
  role: Role,
  opts: { model?: string; provider?: string; routingProfile?: string },
): SelectedModel | { error: string } {
  const profileName = opts.routingProfile ?? cfg.routing.defaultProfile;
  const profile = cfg.routing.profiles[profileName];
  if (!profile) return { error: `unknown routing profile "${profileName}"` };
  const allowedBilling = new Set(profile.billing);
  const billingOk = (p: ProviderDecl) => p.billing !== 'unknown' && allowedBilling.has(p.billing);

  if (opts.provider || opts.model) {
    const providers = opts.provider
      ? cfg.providers.filter((p) => p.id === opts.provider)
      : cfg.providers;
    if (opts.provider && providers.length === 0) {
      return { error: `provider "${opts.provider}" is not declared in orchestrator policy` };
    }
    for (const p of providers) {
      const hit = p.models.find((m) => m.id === opts.model || !opts.model);
      if (!hit) continue;
      if (!billingOk(p)) {
        return {
          error: p.billing === 'unknown'
            ? `provider "${p.id}" has billing "unknown" - never callable; verify and declare real billing`
            : `provider "${p.id}" is billing "${p.billing}" - not allowed by profile "${profileName}"; pass an explicit model AND a profile that includes "${p.billing}"`,
        };
      }
      if (!modelSatisfies(role, hit)) {
        return { error: `model ${hit.id} lacks required capabilities for role ${role.id}` };
      }
      return { provider: p, model: hit.id };
    }
    return { error: `no declared provider/model match for "${opts.model ?? opts.provider}" (policy is explicit; check orchestrator.config.json)` };
  }

  // Automatic routing: free providers only, ever.
  const candidates = autoCandidates(cfg, role);
  const first = candidates[0];
  if (first) return first;
  return { error: `no free provider satisfies role ${role.id}; declare one in providers[] or select a model explicitly` };
}

// Ordered free candidates for a role: routing.roleModels[role.id] first
// (order = preference), then every other declared free capable model.
export function autoCandidates(cfg: OrchestratorConfig, role: Role): SelectedModel[] {
  const out: SelectedModel[] = [];
  const seen = new Set<string>();
  const push = (p: ProviderDecl, id: string) => {
    if (seen.has(id)) return;
    seen.add(id);
    out.push({ provider: p, model: id });
  };
  for (const want of cfg.routing.roleModels[role.id] ?? []) {
    for (const p of cfg.providers) {
      if (p.billing !== 'free') continue;
      const m = p.models.find((mm) => mm.id === want);
      if (m && modelSatisfies(role, m)) push(p, m.id);
    }
  }
  for (const p of cfg.providers) {
    if (p.billing !== 'free') continue;
    for (const m of p.models) if (modelSatisfies(role, m)) push(p, m.id);
  }
  return out;
}

export interface ProviderCallability {
  id: string;
  billing: string;
  callable: boolean;
  reason?: string;
  maxDailyCostUsd?: number;
  models: { id: string; capabilities: string[]; contextTokens?: number }[];
}

export function listPolicyModels(cfg: OrchestratorConfig): ProviderCallability[] {
  const paidProfileExists = Object.values(cfg.routing.profiles).some((p) => p.billing.includes('paid'));
  return cfg.providers.map((p) => {
    let callable = false;
    let reason: string | undefined;
    if (p.billing === 'unknown') reason = 'billing unknown - declare real billing to enable';
    else if (p.billing === 'free') { callable = true; }
    else if (paidProfileExists) { callable = true; reason = 'paid: explicit selection only, never auto-routed'; }
    else reason = 'paid: needs explicit selection plus a profile listing "paid"';
    return {
      id: p.id,
      billing: p.billing,
      callable,
      reason,
      maxDailyCostUsd: p.maxDailyCostUsd,
      models: p.models.map((m) => ({ id: m.id, capabilities: m.capabilities, contextTokens: m.contextTokens })),
    };
  });
}
