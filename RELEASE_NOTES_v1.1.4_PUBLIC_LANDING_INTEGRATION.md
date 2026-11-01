# ADPULSE v1.1.4 — Public Landing Integration

## Scope
Integrated the supplied public-page structure and messaging into the existing React Router / React / tRPC application. The integration deliberately preserves the existing product architecture instead of introducing a second static HTML/REST application.

## Implemented
- Public navigation now links to Features, Pricing, FAQ, Contact and the existing `/login` route.
- Hero copy updated to the ADPULSE guided, secure and measurable AI positioning.
- Added a four-pillar feature section: business diagnosis, permissions and approvals, transparent costs, and business workspaces.
- Contact CTA reuses the existing tRPC lead-capture form and consent flow.
- Existing pricing plans, 30-day pilot language, lead validation, honeypot, consent and backend mutation are preserved.
- Public page visual system aligned to the ADPULSE navy/turquoise CSS reference.
- English translations added for the primary navigation, hero and new feature section through the existing locale provider.

## Deliberate deviations from the supplied static HTML
- No duplicate JavaScript `localStorage` JWT authentication was introduced. The application retains its existing React/tRPC authentication architecture.
- The existing `/login`, `/console`, `/portal` and admin authorization boundaries are retained.
- No fake contact mailbox or unconnected contact endpoint was added.
- The supplied 15-day trial CTA was not represented as an active public entitlement. The existing sales page's 30-day pilot and current plan terms remain authoritative.
- The supplied illustrative metrics were not presented as real company results.

## Validation
This package was statically edited. Build, typecheck, browser rendering, backend integration and end-to-end tests were not completed in this environment because this release archive does not include `app/node_modules`; therefore this release is not certified as build-passing or production-ready.
