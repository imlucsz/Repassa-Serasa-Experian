# Business rules v0.1 (approved concept, proposed numeric defaults)
All dates UTC ISO-8601 on wire; UI America/Sao_Paulo. Use DB/server clock, never client clock. One material record = one physical unit, donation alias. No payments. Staff confirms physical receipt only after verifying actual item. `AVAILABLE` requires accepted receipt and no live reservation.

| Action | Before → after | Actor / conditions |
|---|---|---|
| Submit | none → PENDING_RECEIPT | authenticated STUDENT, active institution, valid item/image |
| Cancel donation | PENDING_RECEIPT → CANCELED | donor only; cannot undo received material |
| Receive | PENDING_RECEIPT → AVAILABLE | staff membership in material institution, record timestamp/actor |
| Reject | PENDING_RECEIPT → REJECTED | same staff, reason required; terminal |
| Reserve | AVAILABLE → RESERVED | student other than donor; atomic; one active reservation, expiry=now+72h (proposed) |
| Cancel reservation | RESERVED → AVAILABLE | reservation owner, active and not expired; terminate reservation CANCELED |
| Expire | RESERVED → AVAILABLE | server clock >= expiresAt; terminate reservation EXPIRED |
| Pickup | RESERVED → DELIVERED | authorized staff at correct institution, one-use valid code before expiry; reservation COMPLETED |

Terminal material states: CANCELED, REJECTED, DELIVERED. Terminal reservation states: CANCELED, EXPIRED, COMPLETED. Preserve immutable history and audit events. No hard delete of received stock. Repeated invalid transitions return 409; idempotent safe reads always return current state. A repeated request after network error can return existing reservation for same owner if implemented/documented; baseline POST reserve returns 409 and client refetches own history. Do not create a second reservation. Do not expose pickup code in public/staff lists or logs.

## Concurrency
Use DB transaction locking material row first, then associated reservation. Reserve, cancel, expiry and pickup all use same ordering; after acquiring lock re-read state and DB time. DB partial unique index on reservations(material_id) WHERE status='ACTIVE'. Update material+reservation+audit in same commit. Handle unique/conflict errors as 409. Before reads that depend on availability, reconcile expired reservations for relevant scope (or query effective availability and transactionally reconcile before mutation). Periodic cleanup optional but must be safe across replicas. Active code not valid at exact expiresAt. Retry bounded transient transaction errors; no blind duplicate actions. Real concurrent test required.

## Pickup code
Use 12 random-looking uppercase Crockford base32 characters, grouped 4-4-4 for display (proposal). Generate deterministically from a cryptographic HMAC of a random reservation UUID using dedicated secret (domain-separated generation and lookup HMAC), or encrypted-at-rest random equivalent if contract stays same. Store unique keyed digest for lookup; never store raw plaintext or log it. With deterministic derivation student can re-view own code without storing plaintext. Handle improbable digest collisions by regenerating reservation ID. Normalize allowed separators/case, reject malformed, constant-time comparison where applicable, scoped staff lookup and throttle attempts. Return generic not-found/invalid for wrong institution; never reveal who owns another reservation. Code shown only to student owner when ACTIVE and unexpired. `confirm` endpoint mutates; preview optional omitted in MVP. Keep key stable for live reservations; rotation plan invalidates/reissues explicitly.

## Validation/defaults
Title 3–120, description 10–1000 characters, pickup institution from active catalog, category enum BOOK/NOTEBOOK/SUPPLIES/OTHER, condition LIKE_NEW/GOOD/FAIR, 1 photo optional in initial slice (required for final donation UX if owner approves), max 5 MiB, JPEG/PNG/WebP. No arbitrary URL from client. Staff reject reason 3–240. Student display name 2–80, email normalized unique, password min 12/max 128, no restrictive composition requirement. Catalog paging default 20, max 50. Other numeric defaults in SECURITY. Validate on server; client mirrors UX. Expiry 72h, public browsing, photo optional and same-donor restriction are proposed decisions; record owner changes before contract break.
