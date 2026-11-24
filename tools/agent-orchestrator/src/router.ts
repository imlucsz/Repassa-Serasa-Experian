// Provider/model resolution against the owner-approved policy list.
import type { OrchestratorConfig, ProviderDecl, Role } from './config.js';

export interface SelectedModel {
  provider: ProviderDecl;
  model: string;
}

// Resolve which provider+model should serve a request.
// - explicit `model` ("provider/model" or bare model id): must exist in policy
// - otherwise: first policy provider whose billing is allowed and whose models
//   cover the role's capabilities
export function selectModel(
  cfg: OrchestratorConfig,
  role: Role,
  opts: { model?: string; provider?: string; routingProfile?: string },
): SelectedModel | { error: string } {
  const profile = cfg.routing.profiles[opts.routingProfile ?? cfg.routing.defaultProfile];
  const allowedBilling = new Set(profile?.billing ?? ['free']);
  const billingOk = (p: ProviderDecl) =>
    allowedBilling.has(p.billing) || (cfg.budget.allowPaidProviders && p.billing !== 'unknown');
  const capOk = (m: { capabilities: string[] }) =>
    role.capabilities.every((c) => m.capabilities.includes(c));

  if (opts.provider || opts.model) {
    const providers = opts.provider
      ? cfg.providers.filter((p) => p.id === opts.provider)
      : cfg.providers;
    if (opts.provider && providers.length === 0) {
      return { error: `provider "${opts.provider}" is not declared in orchestrator policy` };
    }
    for (const p of providers) {
      if (!billingOk(p)) continue;
      const hit = p.models.find((m) => m.id === opts.model);
      if (hit && capOk(hit)) return { provider: p, model: hit.id };
      if (hit) return { error: `model ${hit.id} lacks required capabilities for role ${role.id}` };
    }
    return { error: `no allowed provider/model match for "${opts.model ?? opts.provider}" (policy is explicit; check orchestrator.config.json)` };
  }

  for (const p of cfg.providers) {
    if (!billingOk(p)) continue;
    const m = p.models.find(capOk);
    if (m) return { provider: p, model: m.id };
  }
  return { error: `no provider satisfies role ${role.id} under profile "${opts.routingProfile ?? cfg.routing.defaultProfile}"` };
}

export function listPolicyModels(cfg: OrchestratorConfig) {
  return cfg.providers.map((p) => ({
    id: p.id,
    billing: p.billing,
    note: p.note,
    models: p.models.map((m) => ({ id: m.id, capabilities: m.capabilities, contextTokens: m.contextTokens })),
  }));
}
