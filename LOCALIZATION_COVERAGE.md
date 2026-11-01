# Localization coverage — English and Spanish

## Product language policy

ADPULSE supports exactly two application languages: English (`en`) and Spanish (`es`). The language selector exposes only these two options. Browser regional variants such as `es-MX`, `es-ES`, and `en-US` normalize to their base language. Unsupported languages fall back to English. Both supported languages use left-to-right layout.

## Coverage status

The localization foundation, language selector, locale persistence, document `lang`/`dir` attributes, fallback behavior, and initial shell message catalog are implemented. This does **not** mean every customer-facing surface is fully translated. Sales pages, customer portal, business modules, admin, email/SMS/WhatsApp templates, billing/legal content, and help/support content still require translation coverage and QA.

Do not claim complete bilingual coverage until those surfaces are translated, reviewed, and tested.
