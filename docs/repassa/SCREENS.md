# Screen map / routes (P0 unless marked)
Public browsing allowed; login required for donate/reserve/my pages. Institution requires staff and selected authorized institution. Route paths are frontend only.

| Route | Screen | Acceptance |
|---|---|---|
| `/` | Home | hero with original book collage; value proposition, how-it-works anchor, calls to donate/explore, footer |
| `/entrar` | Login | email/password, visible errors, redirect to safe relative returnTo; staff goes to painel |
| `/cadastro` | Registration | display name/email/password/confirmation; only student; consent notice; no role picker |
| `/catalogo` | Catalog | existing dynamic 3D shelf + accessible grid, query/category/institution filters, paging, empty/error/loading |
| `/materiais/:id` | Material detail | deep link, animated detail when entered from shelf, image/status/condition/institution, reserve CTA; unavailable feedback |
| `/doar` | Donation | instructions, input validation, photo preview/upload, selected point, success pending status |
| `/minhas-doacoes` | My donations | status badges, cancel pending, reject reason, pickup instructions |
| `/minhas-reservas` | My reservations | active code with copy, expiry, institution, cancel confirmation, history |
| `/perfil` | Profile | read own email/name, edit display name, logout |
| `/instituicao` | Staff dashboard | selected membership, real counters and links; no data across tenants |
| `/instituicao/recebimentos` | Receive | pending list, confirm physical arrival or reject with reason |
| `/instituicao/estoque` | Stock | list/filter scoped materials, states and history; no arbitrary status writes |
| `/instituicao/retirada` | Pickup | enter pickup code, confirm physical handoff, accessible result and reset |
| `*` | Not found | clear return paths |
| `/recuperar-senha` | Password recovery (P1) | prerequisite for real public onboarding |

Shared layouts: PublicNav and Footer, StudentNav (doar/catalogo/minhas doações/reservas/perfil), InstitutionNav (dashboard/recebimentos/estoque/retirada). P0 confirmation states inline/modal instead of separate routes. For institution multi-membership show selector, always validate on API. Private routes wait for auth bootstrap, preserve requested safe redirect, 403 clear, never simulate permission granted. Each screen handles loading, empty, validation, error, retry and success with keyboard/reader support. No fake links. Mobile catalog grid default or toggle; shelf is showcase not barrier.
