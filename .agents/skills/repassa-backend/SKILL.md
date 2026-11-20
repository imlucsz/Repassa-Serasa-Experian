---
name: repassa-backend
description: Implement or review RePassa NestJS and Fastify modules, DTOs and API behavior against the approved OpenAPI contract.
---

# Implement a backend slice

1. Load `repassa-implement`. Read [architecture](../../../docs/repassa/ARCHITECTURE.md), [API](../../../docs/repassa/API.md) and the affected operations in [OpenAPI](../../../docs/repassa/contracts/openapi.yaml). Record the accepted inputs, statuses, response shape and actor for each operation. Coordinate contract changes using the Agent Kit.
2. Fit the slice into the existing NestJS modular monolith. Keep controllers as the HTTP boundary, enforce DTO validation at runtime, inject providers and keep transactional business decisions in services. Verify the Fastify adapter behavior and versioned install scripts before applying framework patterns.
3. Match the contract for errors, pagination, enums and serialization. Validate ownership and institution scope in the backend using `repassa-auth-security`. Apply `repassa-database` for constraints, transactions and migrations. Keep database errors and sensitive fields out of responses.
4. Use `repassa-verification` to prove success and failure behavior. Include contract status/body assertions, authorization denials and database-backed behavior where relevant.
