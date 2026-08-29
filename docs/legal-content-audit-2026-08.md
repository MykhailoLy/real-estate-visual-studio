# PicchuSpot legal and content audit — 2026-08

## Scope and method

This document is the implementation fact matrix for the 2026-08 legal-content refresh. It records what the production-facing repository actually does, what can be stated cautiously, and what still requires owner or legal input. It is an engineering and content-alignment review, not a substitute for advice from qualified Spanish counsel.

Evidence was taken from the application code, the public pages that were live at the start of the work, and the official sources linked below. No production data, secrets, environment values, or provider dashboards were accessed.

Status labels:

- **Confirmed** — directly evidenced by current application code or public content.
- **Inferred** — a cautious conclusion from the confirmed implementation; avoid presenting it as an absolute fact.
- **Unknown / owner input** — not established by the repository and must not be invented.

## Fact matrix

| Area | Status | Implementation fact | Legal-content consequence |
| --- | --- | --- | --- |
| Operator | Confirmed | The public trading name is PicchuSpot, the service operates from Spain, and the public contact is `hello@picchuspot.com`. | These facts may be used in the policies. They are not a complete statutory operator identity. |
| Operator identity | Unknown / owner input | The repository does not establish the operator's full legal name or company name, NIF/NIE/CIF/VAT identifier, service/business address, registry details, or regulated-profession/authorisation details if applicable. | Do not publish a Legal Notice with placeholders. Obtain the missing details first. |
| Customer identity | Confirmed | New orders require an authenticated Supabase session. Server-side profile/session data is used for customer identity; anonymous public order submission is not the active flow. | Terms can describe an authenticated customer order flow. |
| Order creation | Confirmed | Submission creates a pending order and an immutable server-created pricing snapshot. Terms acceptance is required. | Terms should distinguish order submission from payment and from the start of production. |
| Terms evidence | Confirmed | The UI sends a terms version and the server records it, but the server does not currently replace a browser-supplied version with the current server constant in every route. | Publish version `2026-08`, but track server-side version enforcement as a separate runtime hardening task. |
| Online payment eligibility | Confirmed | Hosted Stripe Checkout is available only for eligible fixed-price remote services and verified pricing snapshots. Custom quotes and unsupported/local services follow a separate quote or manual-payment path. | Avoid suggesting that every service can be paid immediately online. |
| Payment start condition | Confirmed | Customer UI states that payment is required before work begins. Stripe webhook verification updates payment status. | Terms may state that production normally begins after verified payment and complete inputs/scope. |
| Payment data | Confirmed | Eligible payments use Stripe-hosted Checkout. PicchuSpot's order form does not collect the full card number or CVC. | State the narrow fact; do not promise absolute security or claim that PicchuSpot never processes any payment-related personal data. |
| Currency and tax | Confirmed | The pricing system supports USD, CAD, and EUR. Hosted Checkout uses automatic tax and tax-inclusive line items, with tax displayed by Stripe when applicable. | Legal copy should say online Checkout shows an applicable tax-inclusive total. Existing FAQ copy saying prices exclude tax conflicts with the live implementation. |
| Fixed-price limits | Confirmed | Supported remote services become custom-quote orders at 50 or more eligible units. Volume discounts are represented in server pricing. | Do not duplicate thresholds or discount arithmetic in legal pages; point to the order summary or written quote. |
| Turnaround | Confirmed | Public service content describes a usual 24–48 hour turnaround for most remote services, subject to service and scope. Local services depend on scheduling. | Treat 24–48 hours as an estimate beginning after complete inputs, confirmed scope, and payment—not a guaranteed SLA. |
| Revisions | Confirmed | Public content describes one revision per ordered item unless a quote or order states otherwise. A deliverable review/rework workflow exists. | Preserve the included-revision statement with scope and eligibility qualifications. |
| Refund automation | Confirmed | Stripe refund webhook states are handled, but no customer-facing automatic-refund workflow or unconditional refund promise is evidenced. | Refund policy should explain request and review paths and preserve mandatory consumer remedies. |
| Consumer withdrawal | Confirmed gap | The current general terms checkbox does not separately capture a consumer's express request to begin performance during the 14-day withdrawal period and acknowledgement of the consequences of complete performance. | Do not claim a blanket waiver. Track explicit early-performance consent as a separate order-flow/legal task. |
| Customer source files | Confirmed | Source uploads and rework references use a private `order-files` bucket. Access is ownership-controlled and delivered through signed URLs. | Privacy copy may explain private storage and access controls without exposing paths or promising perfect security. |
| Deliverables | Confirmed | Finished files use a private `deliverables` bucket and signed access. | Describe access at a category level; do not publish raw object paths. |
| Portfolio permission | Confirmed | Portfolio permission is optional and defaults off in the order terms UI. Public portfolio visibility is separately controlled. | Terms and privacy copy should make promotional use opt-in and distinguish it from service delivery. |
| Supabase | Confirmed | Supabase provides authentication, database, and private storage infrastructure. Browser auth uses cookies. | List Supabase as an infrastructure recipient/processor category and describe authentication cookies as necessary. |
| Stripe | Confirmed | Stripe provides hosted payment Checkout for eligible orders and sends payment/refund events to the server. | Identify Stripe as payment provider; Stripe-hosted technology is also subject to Stripe's own information. |
| Resend | Confirmed | Resend is used for transactional order, payment, review, and property-enquiry email. | Identify transactional email delivery as contract/legitimate operational processing, as applicable. |
| Vercel | Confirmed | The application is hosted on Vercel. | Identify hosting and security/logging infrastructure at a category level. |
| Google Analytics | Confirmed | The Google tag can load with Consent Mode defaults denied. Application page-view configuration and analytics events are enabled only after the visitor accepts analytics. Advertising consent signals remain denied. Admin and dashboard areas are excluded. | Cookie policy must describe consent-controlled analytics and the permanent Cookie settings control. Avoid claiming that script loading and provider communication are identical to cookie storage. |
| Consent choice | Confirmed | `picchuspot_cookie_consent` in local storage records accepted/rejected status. Reject keeps analytics storage denied. | Describe the choice as browser storage, not as a cookie. Accept and Reject must remain equally available. |
| Language preference | Confirmed | Language uses a one-year first-party cookie (`picchuspot_language`) and local storage (`picchuspot-language`). | Classify as functional/remembered preference. |
| Region and currency | Confirmed | Region and currency use one-year first-party cookies and matching local-storage values. | Classify as user-requested functional preferences. |
| Session storage | Confirmed | Order-form recovery and the support chat keep limited browser-session state. Completed support history is capped and stored under `picchuspot_support_chat_session_v1`. | Explain that session storage ends with the browser session in normal operation; do not call it a server retention period. |
| Gemini support assistant | Confirmed | Recent support conversation content is sent to Google's Gemini service to generate a reply with provider request storage disabled (`store: false`). The site does not persist the transcript to its application database. | Explain the external transmission. `store: false` must not be presented as “no processing” or “no provider retention under all circumstances.” |
| Support rate limiting | Confirmed | The server HMAC-hashes a trusted forwarded IP before using Upstash for rate limiting. Upstash analytics is disabled. | Explain fraud/abuse prevention without claiming that infrastructure never receives normal network metadata. |
| Crisp handoff | Confirmed | Crisp loads in production only after the visitor explicitly requests human support. Submitted email, optional name, locale, page path, limited recent context, and subsequent messages may be sent. Configured Crisp cookie expiry is 30 days. | Crisp belongs in the cookie/privacy disclosures as an on-demand support provider. Analytics consent is separate from a requested support handoff. |
| Turnstile | Confirmed | Cloudflare Turnstile is used on relevant authentication and property-enquiry forms when configured. | Classify as security/fraud prevention. Avoid naming `cf_clearance` because the repository does not establish pre-clearance mode. |
| Property leads | Confirmed | Property enquiries include contact/message data, are protected with Turnstile, and are delivered to the intended business contact by server-side processes. | Include enquiry handling, recipients, and contract/legitimate-interest bases as context requires. |
| Property-view analytics | Confirmed | Published property pages send allowlisted event names to a first-party endpoint. Stored rows contain property/event identifiers and timestamps, but no visitor identifier, email, phone number, or application-level IP field. | Describe this as first-party aggregate operational measurement, not Google Analytics and not visitor profiling. Normal hosting requests can still contain transient technical metadata. |
| Retention | Unknown / contextual | The repository does not establish a single defensible fixed deletion period for every order, accounting, support, lead, or file category. | Use purpose-, contract-, dispute-, security-, and statutory-retention criteria. Do not invent exact periods. |
| International processing | Inferred | Several named providers are international technology companies and processing may occur outside the EEA under their applicable contractual transfer mechanisms. | Give a cautious transfer disclosure and invite requests for applicable safeguard information. Do not name a mechanism that has not been contractually verified. |
| Automated decisions | Confirmed | No solely automated decision with legal or similarly significant effects is evidenced. The support assistant gives guidance and does not submit orders or set binding prices. | State that no such significant automated decision-making is intended. |

## Legal requirement matrix

| Priority | Requirement | Application to PicchuSpot | Official basis |
| --- | --- | --- | --- |
| Required | Permanent, easy and free access to full provider identity, Spanish establishment/address, direct contact, tax identifier and applicable registry/professional details. | Blocked pending owner identity fields; do not publish a placeholder Legal Notice. | [LSSI, article 10](https://www.boe.es/eli/es/l/2002/07/11/34/con) |
| Required | Clear pre-contract information about the service, total price/tax method, provider, consumer rights, process and payment obligation. | Terms and refund pages should align with the actual two-step pending-order/hosted-payment flow. The public tax FAQ mismatch needs a separate content correction. | [Consumer Act, articles 60, 97 and 98](https://www.boe.es/eli/es/rdlg/2007/11/16/1/con) |
| Required | Electronic-contract information about steps, archiving/access, correction, languages and reproducible terms; confirmation by email or equivalent durable/archivable means. | Terms should describe the order path. Portal and transactional confirmation exist; email delivery is operationally best effort. | [LSSI, articles 27 and 28](https://www.boe.es/eli/es/l/2002/07/11/34/con) |
| Required | Preserve the 14-day distance-contract withdrawal regime and the specific rules for starting/fully performing services during that period. | Publish accurate consumer wording. The current generic checkbox is not evidence of the separate express early-performance request described by the statute. | [Consumer Act, articles 102–108](https://www.boe.es/eli/es/rdlg/2007/11/16/1/con) |
| Required | Transparent controller identity/contact, purposes and legal bases, recipients, transfers, retention criteria, rights, complaint route and significant automated-decision information. | Privacy policy must be expanded. Full controller identity remains owner input. | [GDPR, articles 12–13](https://eur-lex.europa.eu/eli/reg/2016/679/oj) |
| Required | Appropriate security measures proportionate to risk. | Describe controls factually without promising immunity from incidents. | [GDPR, article 32](https://eur-lex.europa.eu/eli/reg/2016/679/oj) |
| Required | Consent for non-exempt terminal storage/access after clear information; necessary storage may be exempt. | Keep analytics opt-in and Accept/Reject parity. Explain preference, security, support and analytics storage distinctly. | [LSSI, article 22.2](https://www.boe.es/eli/es/l/2002/07/11/34/con) and [AEPD Cookie Guide](https://www.aepd.es/recurso-multimedia/guia-sobre-el-uso-de-las-cookies) |
| Required | A usable route to exercise data rights and complain to the competent authority. | Keep `hello@picchuspot.com` as the direct route and link to the AEPD. | [AEPD rights guidance](https://www.aepd.es/derechos-y-deberes/ejerce-tus-derechos) and [AEPD complaints guidance](https://www.aepd.es/preguntas-frecuentes/13-reclamaciones) |
| Recommended | One shared, versioned legal-page system with EN/ES parity and clear effective date. | Use a central `2026-08` version and shared editorial page layout. | Content governance control. |
| Recommended | Keep policy claims traceable to code and avoid fixed promises that operations do not guarantee. | Qualify turnaround, retention, refunds, transfers and security. | Risk-control and accuracy practice. |
| Optional | A separate Payment Security page. | Not recommended now. Hosted Checkout can be explained concisely in Terms and Privacy; a separate page would repeat content and could invite overbroad security claims. | Editorial decision. |

## Production-content mismatches and follow-up work

These issues should not be silently “fixed” inside protected runtime systems in this content PR:

1. **Tax wording:** the public FAQ says prices exclude taxes and taxes are calculated separately, while eligible hosted Checkout uses tax-inclusive line items and shows applicable included tax. Update the pricing/FAQ content in a focused follow-up after product-owner confirmation.
2. **Terms-version integrity:** enforce the current terms version server-side instead of accepting a browser-supplied value in every order path. This is a small future hardening change to protected order-submission logic.
3. **Early service performance:** obtain Spanish legal advice on adding a separate, explicit consumer request to start work within the withdrawal period and the acknowledgement required for completed performance. This affects protected order/payment sequencing and should be handled separately.
4. **Statutory operator identity:** obtain and verify the full legal/operator information listed below before adding a public Legal Notice or claiming complete article 10/article 13 identification.
5. **Direct contact information:** confirm the consumer-support telephone number and, if different, the address used for complaints/withdrawal communications.

## Owner input required before a Legal Notice

- Full legal name of the individual operator or full registered company name.
- NIF, NIE, CIF or VAT identifier, as applicable.
- Full residence, establishment or business/service address in Spain suitable for the statutory notice and consumer communications.
- Mercantile or other public-register name, volume, book, section, page and registration number, if applicable.
- Details of any prior administrative authorisation and supervising authority, if applicable.
- For any regulated profession: professional body, membership number, qualification, issuing state and applicable professional rules, if applicable.
- A direct consumer-support telephone number, or confirmation from Spanish counsel of the appropriate published direct-contact arrangement for this business.

Until these fields are supplied and verified, the footer should not contain a Legal Notice link and no production Legal Notice route should be published.

## Implementation decisions

- Publish updated Terms and Privacy pages in English and Spanish.
- Add dedicated Cookie Policy and Refunds & Cancellations pages in English and Spanish.
- Add Cookie Policy and Refunds links to the footer and make the cookie banner's policy link locale-aware.
- Preserve cookie Accept/Reject behaviour, authentication, uploads, pricing, order submission, Stripe integration, email delivery, storage and database policies.
- Do not publish a Legal Notice until the owner-input block is resolved.
- Do not add a separate Payment Security page.
