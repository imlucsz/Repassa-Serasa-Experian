---
name: repassa-auth-security
description: Implement or defensively review RePassa authentication, role and resource authorization, institution isolation and handling of private data.
---

# Verify auth and security boundaries

1. Read [security policy](../../../docs/repassa/SECURITY.md) and the corresponding [OpenAPI](../../../docs/repassa/contracts/openapi.yaml) operations. Map actor, resource, institution, user-controlled inputs and data returned. Inspect the guard and query/service path.
2. Derive identity and scope on the server. Check authentication, role and object-level ownership or institution eligibility. Enforce the documented validation, CSRF/origin checks, cookie settings, rate limits and no-store behavior. Verify refresh rotation, session invalidation and scope checks where those paths change.
3. Review pickup state, validity period and scoped single-use confirmation. Keep raw codes, tokens, hashes, digests, storage keys and personal data out of logs and unauthorized responses. Inspect upload type, size, storage access and ownership whenever uploads change.
4. Write or inspect authorized and denied tests with synthetic identities in a controlled local environment. Exercise cross-student and cross-institution access and check the contract's response for hidden resources. Report affected locations, impact and a defensive remediation. Run the existing Git guard for changed paths.
