# ADPULSE — US market scope v1.1.5

## Product decision
ADPULSE is a B2B SaaS product for businesses operating in the United States. It is not an international-market launch.

- Initial go-to-market: Florida.
- Expansion target: other US states after operational, legal, tax, support, and unit-economics validation.
- Currency: USD.
- Product languages: English and Spanish only.
- Customer portal and platform administration remain separate authorization surfaces.
- Internal agent orchestration, infrastructure, provider credentials, and system prompts are not customer-facing.

## Compliance boundary
This document is a product-scope decision, not legal advice or a compliance certification. Applicability depends on the actual data processed, customer industry, states served, communication channels, payment flow, and vendor relationships.

Before launch, obtain qualified review of:
- Federal and state privacy/security obligations applicable to the data and business model.
- Florida privacy and data-security requirements, including breach-response obligations where applicable.
- CAN-SPAM for commercial email and TCPA/FCC/state rules for calls and text messaging where applicable.
- Federal/state consumer-protection and subscription-renewal requirements.
- State/local sales-tax and economic-nexus obligations; configure collection/remittance only after tax review.
- Contract terms, privacy notice, data-processing/vendor terms, retention/deletion, incident response, and customer support commitments.
- PCI scope and payment-provider responsibilities. Do not store raw card data.
- HIPAA only if the product is actually used by covered entities/business associates for protected health information and the applicable role/contractual requirements are met. Do not claim HIPAA compliance by default.

## Commercial guardrails
- Prices in the source application are proposed offers, not validated willingness-to-pay or achieved revenue.
- Do not activate live charges without explicit price/terms acceptance and tested payment webhooks.
- Do not represent simulated dashboard metrics as customer results, revenue, uptime, or agent activity.
- Do not claim SOC 2, PCI DSS, HIPAA, or other certification without independent evidence and scope.
