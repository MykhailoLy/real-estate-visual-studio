# UNLIMITED-USE AUDIT — PicchuSpot (real-estate-visual-studio)

Дата: 2026-11-06
Режим: READ-ONLY аудит (без изменений кода, без установок, без git-операций, без build/dev, без Playwright e2e).
Рабочая ветка: `feat/gallery-links-and-sitemap` (HEAD `f46def8`, на 1 коммит ahead `origin/main`; рабочее дерево чистое, кроме untracked `.zcode/`, `debug.log`, `docs/seo/AUDIT-HANDOFF.md`).

---

## 1. Сводка стека и структуры

**Стек:** Next.js 16.3.8 (App Router, НЕСТАНДАРТНАЯ версия — гайды в `node_modules/next/dist/docs/`), React 19.2.4, TypeScript 5 (strict), Tailwind CSS 4, Supabase (@supabase/ssr + service-role на сервере), Stripe, Resend, Upstash Redis (rate limiting), Gemini (@google/genai — support-ассистент), Vercel.

**Структура `src/` (~671 исходных .ts/.tsx, 150 test-файлов, 69 route.ts):**

| Область | Расположение |
|---|---|
| Публичные страницы EN | `src/app/(default)/(public)/` — `/gallery`, `/pricing/<service>` (10 сервисов), `/order` (каталог), `/blog`, `/legal`, `/admin/*` |
| Локализованные ES | `src/app/(localized)/[locale]/(public)/` — зеркала EN-страниц |
| Клиентский портал | `src/app/(default)/(dashboard)/dashboard/` — orders/new (7 форм услуг), jobs, files, invoices, profile, support |
| Property Showcase | `src/app/(showcase)/property/[slug]`, админка в двух группах `(default)/(showcase)` и `(showcase)/admin` |
| API: заказы | `(public)/api/order`, `api/upload-url` (signed upload), `api/order-drafts/...` (10+ вложенных роутов) |
| API: оплаты | `api/payments/checkout`, `summary`, `webhook` (Stripe) |
| API: клиент/админ | `api/client/*` (deliverables, reviews), `(public)/api/admin/*` (orders, portfolio, media, properties, clients, reviews) |
| API: internal | `api/internal/order-email-outbox`, `api/internal/account-deletions` (CRON_SECRET) |
| Ключевые модули | `lib/pricing/` (каталог+калькулятор+snapshot), `lib/order-drafts/` (черновики, финализация, файлы), `lib/orders/` (атомарная отправка, recovery), `lib/payments/`, `lib/uploads/file-signature.ts` (magic-bytes), `lib/support-assistant/`, `lib/email/` |
| Инфраструктура | `supabase/` (~30 идемпотентных SQL-миграций + tests), `e2e/` (smoke, partner-invites, order-submission-recovery), `scripts/` (backfill, postgres-тесты), `docs/` (F1–F9 runbook'и, SEO policy) |

**Архитектурные якоря (ARCHITECTURE-DECISION.md):** Supabase + Resend (Option B) — соблюдён; единый бэкенд заказов на все услуги; приватный бакет `order-files` + публичный `portfolio`/`site-media`. AGENTS.md: защищённые системы (заказы, загрузки, платежи, прайсинг, админ-аутентификация) не тронуты аудитом.

---

## 2. Результаты запущенных проверок

| Проверка | Результат | Детали |
|---|---|---|
| `npm run lint` | **0 ошибок, 25 предупреждений** | 16 предупреждений — артефакты `.zcode/workflow-runs/dwfrun-*.mjs` (no-unused-expressions); 9 — `@next/next/no-location-assign-relative-destination`: `src/components/dashboard/SignOutButton.tsx:27`, `src/components/order/order-redirect.ts:27,32`, `FloorPlansOrderForm.tsx:1021,1025`, `PhotoEditingOrderForm.tsx:994,998`, `VirtualRenovationOrderForm.tsx:1402,1406` |
| `npm run typecheck:test` | **PASS** (exit 0) | `tsc -p tsconfig.test.json`, без ошибок |
| `npm run test:pricing` | **PASS: 72/72** | каталог, калькулятор, welcome-offer (USD/EUR/CAD), snapshot, partner-pricing |
| `npm run test:order-drafts` | **PASS: 108/108** | черновики, floor-plans, photo-editing, virtual-renovation, финализация |
| Точечный запуск сиротских тестов (см. находку F2) | `admin-login` 12/12 ✔, `rework-submission` 25/25 ✔, `private-image-preview-routes` 6/6 ✔ | **`server-zip-download` 1/2 ✖ (падает), `private-image-preview` ✖ (не грузится), `scripts/backfill-private-image-previews` ✖ (не грузится)** |

Playwright e2e не запускался (по ограничению задачи). `next build`/`next dev` не запускались.

---

## 3. Находки по категориям

Формат: `файл:строка` — суть — приоритет (P0>P1>P2>P3) — трудозатраты (S<1ч, M~1день, L>2дня).

### 3.1 Тесты и CI

- **F1 (P1, S)** `src/lib/server-zip-download.test.ts:221` — тест «client delivered ZIP keeps every current file at the archive root» **падает**: `TypeError: supabase.from(...).select(...).eq(...).neq is not a function`. Роут `src/app/api/client/orders/[orderId]/deliverables/bulk-download/route.ts:78` получил `.neq("status","pending_review")` в коммите `33585c8` (#355), мок Supabase в тесте не обновлён. Тест вне `test:ci`, поэтому регрессия невидима.
- **F2 (P1, M)** 7 тест-файлов **не подключены ни к одному npm-скрипту** (и к `test:ci`): `src/lib/admin-login.test.ts`, `src/lib/rework-submission.test.ts`, `src/lib/private-image-preview.test.ts`, `src/lib/private-image-preview-routes.test.ts`, `src/lib/server-zip-download.test.ts`, `src/lib/admin-replacement-route.test.ts`, `src/lib/admin-replacement-upload-client.test.ts`, `src/components/dashboard/deliverable-rework-submit.test.ts`, `scripts/backfill-private-image-previews.test.ts`, `scripts/seo-audit.test.mjs` (проверено grep'ом по package.json). Покрытие есть, но CI его не гоняет — уже есть 3 сломанных файла.
- **F3 (P2, S)** `src/lib/private-image-preview.test.ts:1`, `scripts/backfill-private-image-previews.test.ts:4` — падают при прямом `node --test`: тестируемые модули импортируют `server-only`, который бросает исключение вне react-server-условий (скриптам backfill в package.json корректно задан `--conditions=react-server`, тестам — нет).
- **F4 (P3, S)** `package.json:2` — нет `"type": "module"`: каждый прогон node:test эммитит `MODULE_TYPELESS_PACKAGE_JSON` warning (косметика, но шум в каждом CI-логе).

### 3.2 Безопасность

- **F5 (P2, M)** `src/lib/security-headers.ts:32` — CSP `script-src` содержит `'unsafe-inline'` (нужен для inline-скриптов GA/Crisp) без nonce/hash-стратегии. Это главное ослабление XSS-защиты; при наличии CSP остальное (frame-ancestors none, object-src none, form-action self, строгий img/connect) — на хорошем уровне.
- **F6 (P2, S)** Переменные окружения, используемые кодом, но **отсутствующие в `.env.example` и таблице README**: `GEMINI_API_KEY` (`src/lib/support-assistant/gemini-transport.ts:16` — без него support-ассистент недоступен), `FROM_EMAIL` (`src/lib/email/resend-client.ts:52`), `NEXT_PUBLIC_GA_MEASUREMENT_ID` (`src/components/analytics/GoogleAnalytics.tsx`), `SUPPORT_RATE_LIMIT_SECRET` (упомянут только в комментарии `.env.example:41`). Риск: чеклист деплоя неполон, feature молча деградирует.
- **F7 (P3, S)** `src/app/(public)/api/upload-url/route.ts` — нет rate limiting (только аутентификация; в отличие от `/api/support`, property-leads и admin-login, где Upstash fail-closed). Аутентифицированный пользователь может генерировать signed URL без ограничений; смягчается magic-bytes-верификацией и приватным бакетом.
- **F8 (P3, S)** `src/components/dashboard/ClientDashboardTopNav.tsx:337`, `src/components/auth/PublicAccountMenu.tsx:57` — аватар из user_metadata подставляется напрямую в `style={backgroundImage: url("...")}`. Протокол валидируется в `src/lib/client-auth.ts` (http/https), а `"` нормализуется WHATWG URL-парсером, но прямая интерполяция в style-атрибут — хрупкий паттерн; безопаснее экранировать или отдавать через `<img>`.
- **F9 (P3, S)** `src/lib/upload-config.ts:33-40` — `application/octet-stream` разрешён для floor-plan загрузок (любой бинарный файл с расширением `[a-z0-9]{1,16}`). Компенсируется server-side проверкой magic-bytes (`src/lib/uploads/file-signature.ts`) — риск низкий, но осознанный допуск стоит задокументировать.

**Положительное (проверено):** timing-safe сравнение пароля и HMAC-cookie админа (`admin-auth.ts`), fail-closed rate-limit на login (5/5м + 20/60м), `CRON_SECRET` constant-time в обоих internal-роутах, Stripe webhook signature verification, Turnstile fail-closed у лидов, escape-html в email-шаблонах, `JsonLd` экранирует `<`, robots закрывает `/admin`, `/dashboard`, `/api`, RLS-hardening миграции присутствуют. Секреты в git не трекаются (`.env.local` игнорируется, в индексе только шаблон `.env.example`).

### 3.3 Архитектура и документация

- **F10 (P2, S)** Два параллельных фабрикатора service-role клиента: `src/lib/supabase.ts:14 createServerClient()` (без auth-опций) и `src/lib/supabase-admin.ts:17 getSupabaseAdminClient()` (с `persistSession:false`), плюс inline `createClient(url, key)` в `src/app/(public)/api/upload-url/route.ts:57`. AGENTS.md прямо запрещает параллельные реализации существующих систем; у behavior есть тонкие различия (см. ветку `f46def8`, где параметр fetcher уже вычистили из одного из них).
- **F14 (P2, S)** Текущая ветка `feat/gallery-links-and-sitemap` (коммит `f46def8`): удалён `export const revalidate = 300` из `src/app/sitemap.ts` и `unstable_cache` из `src/lib/gallery-sitemap.ts`. `revalidatePath('/sitemap.xml')` в `src/lib/portfolio-server.ts:326` продолжает вызываться, но режим рендеринга metadata-роута после удаления revalidate стоит верифицировать после деплоя (риск: sitemap замрёт на билд-снапшоте, либо наоборот начнёт ходить в Supabase на каждый запрос).
- **F11 (P3, S)** `ARCHITECTURE-DECISION.md:326-327` — документ в статусе «AWAITING APPROVAL» при полностью реализованном и работающем стеке; устаревший статус вводит в заблуждение.
- **F12 (P3, S)** `README.md:57-58` — «Two SQL files under supabase/», фактически в каталоге ~30 миграций (deliverable-reviews, property-showcase, welcome-offer и т.д.); раздел БД устарел (пересекается с F6 по полноте).
- **F13 (P3, S)** Корень репозитория: 9 исторических `PHASE5*-AUDIT.md` + `WEBSITE-PLAN-PHASE1-MVP.md` (52 КБ) — перенести в `docs/archive/` для читаемости корня.
- **F15 (P3, S)** 19 **пустых каталогов-заготовок** в `src/app`: `(public)/qa-order-navigation`, `(public)/supabase-client-investigation`, `(public)/__optimizer-check`, `(public)/_order-review-qa`, `(public)/optimizer-check-temp`, `(public)/order-review-qa`, `codex-order-guidance-qa`, `codex-context-followup-qa/{floor-plans,order-detail,virtual-renovation}`, `codex-reference-scroll-test`, `draft-navigation-investigation`, `qa-dashboard-preview`, `review-card-qa`, `__qa-dashboard`, `__codex-order-guidance-qa`, `__codex-reference-scroll-test`, `__dashboard-preview`, `api/supabase-fixture/[...path]` — мёртвые scaffolding-каталоги от прошлых QA-сессий; удалить.

### 3.4 Техдолг и качество кода

- **F17 (P3, M)** `package.json:71` — `test:ci` это монолитная `&&`-цепочка из ~52 скриптов: первый падающий обрывает всё, диагностика по одному ретраю за раз; нет отчёта по всем скоупам сразу.
- **F18 (P3, M)** `src/lib/` — ~120 файлов в плоском каталоге (серверные/клиентские/утилиты вперемешку); подкаталоги `order-drafts/`, `payments/`, `support-assistant/`, `pricing/` уже показывают правильный паттерн — можно продолжать по мере изменений (не рефакторить ради рефакторинга, AGENTS.md KISS).
- **F19 (P3, S)** `src/data/portfolio.ts:8` — `// TODO: Add real portfolio items with before/after images`: заглушка данных 2026-06 года при живой Supabase-портфолио-системе; проверить потребителей и удалить/пометить.
- **F20 (P3, L)** Гигантские клиентские компоненты: `admin/properties/PropertiesAdminClient.tsx` (3559 строк), `virtual-staging/VirtualStagingOrderForm.tsx` (3427), `VirtualRenovationOrderForm.tsx` (2082), `Header.tsx` (1733), `PhotoEditingOrderForm.tsx` (1608). Все покрыты тестами и работают, но любая правка — высокий риск регрессии; декомпозировать постепенно, только при очередных изменениях.
- **F21 (P3, S)** 292 `console.*` в src (серверные роуты + клиентские формы). Серверные логи (`[upload-url]`, `portfolio:` и т.п.) — без PII по выборке; рекомендуется точечная ревизия, что в логи заказов/клиентов не попадают email/имена.
- **F16 (P3, S)** `debug.log` (Chromium DNS-warnings) и `.zcode/` лежат в корне без записи в `.gitignore`; линтер подхватывает `.zcode/workflow-runs/*.mjs` — 16 из 25 warning'ов `npm run lint` — это шум от инструментов, а не кода (добавить в eslint `globalIgnores`/`.gitignore`).

### 3.5 Соответствие ARCHITECTURE-DECISION.md

Соблюдено: Option B (Supabase БД + Storage + Resend), App Router, react-hook-form+zod, приватные бакеты, один бэкенд заказов на все услуги,匿名-сабмит не возвращён, service-role не покидает сервер (найдено 26 чтений `SUPABASE_SERVICE_ROLE_KEY` — все в серверных файлах; в клиентские бандлы не попадает). Расхождение только организационное — F10 (дублирование клиента) и F11 (устаревший статус документа).

---

## 4. Итоговая статистика находок

| Приоритет | Количество |
|---|---|
| P0 | 0 |
| P1 | 2 (F1, F2) |
| P2 | 5 (F3, F5, F6, F10, F14) |
| P3 | 14 (F4, F7, F8, F9, F11–F13, F15–F21) |
| **Всего** | **21** |

---

## 5. Топ-10 рекомендуемых фиксов (план следующей фазы)

1. **F1 (P1, S)** — обновить мок в `server-zip-download.test.ts` под `.neq(...)` из #355, тест снова зелёный; включить файл в скрипт (см. п.2).
2. **F2 (P1, M)** — подключить все сиротские тесты к npm-скриптам и в `test:ci` (admin-login, rework-submission, private-image-preview*, server-zip-download, admin-replacement*, deliverable-rework-submit, seo-audit.test.mjs, backfill-private-image-previews) — гарантия, что «покрытие» реально работает.
3. **F3 (P2, S)** — починить инвокацию `private-image-preview.test.ts` и `scripts/backfill-private-image-previews.test.ts` (`--conditions=react-server` или мок `server-only`).
4. **F6 (P2, S)** — дополнить `.env.example` и таблицу README: `GEMINI_API_KEY`, `FROM_EMAIL`, `NEXT_PUBLIC_GA_MEASUREMENT_ID`, `SUPPORT_RATE_LIMIT_SECRET`.
5. **F10 (P2, S)** — унифицировать service-role клиент на `getSupabaseAdminClient()` (убрать `createServerClient`-дубль и inline-создание в upload-url), с проверкой поведения на прод-совместимость.
6. **F14 (P2, S)** — после деплоя ветки `feat/gallery-links-and-sitemap` верифицировать режим рендеринга `sitemap.xml` (перерендер через `revalidatePath` vs заморозка на билде); при необходимости вернуть `export const revalidate`.
7. **F5 (P2, M)** — стратегия ухода от `'unsafe-inline'` в `script-src` (nonce/hashes для GA+Crisp инлайнов или их вынос), с сохранением работы аналитики и чата.
8. **F16 (P3, S)** — добавить `debug.log`, `.zcode/` в `.gitignore` и `.zcode/` в eslint `globalIgnores`.
9. **F15 (P3, S)** — удалить 19 пустых QA/scaffolding-каталогов в `src/app`.
10. **F11/F12/F13 (P3, S)** — док-хедерах: актуализировать статус ARCHITECTURE-DECISION.md, переписать раздел БД в README (полный список миграций), перенести PHASE5*-доки в `docs/archive/`.

Следующие по приоритету после десятки: F7 (rate-limit на upload-url), F17 (разбить test:ci), F19 (TODO в data/portfolio.ts).

---

*Аудит выполнен только чтением, разрешёнными командами проверки — lint, typecheck:test, test:pricing, test:order-drafts и точечные node:test прогоны сиротских файлов. Никакие файлы, кроме этого отчёта, не создавались и не изменялись; git-операции записи не выполнялись.*
