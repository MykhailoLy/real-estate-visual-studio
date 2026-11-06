# UNLIMITED-USE FIXES — PicchuSpot (real-estate-visual-studio)

Дата: 2026-11-06
Режим: фаза исправлений по объёму, утверждённому после аудита `UNLIMITED-USE-AUDIT-2026-11-06.md` (пункты A–D, ничего больше).
Рабочая ветка: **`fix/unlimited-use-pass`**. Изначально коммит `90a2971` был создан поверх `feat/gallery-links-and-sitemap` (`f46def8`). После ревью на этой же ветке перенесён только `90a2971` на актуальную `origin/main` (`e867292f7c260011882861dabc881ecc9306efda`), затем уточнено обоснование CSP nonce. Собственный дифф ветки содержит только семь файлов исправлений A–D; изменений галереи и sitemap поверх `main` нет. Незакоммиченные `.zcode/`, `debug.log` и `docs/seo/AUDIT-HANDOFF.md` сохранены.

Гайды версии Next.js 16.3.8 в `node_modules/next/dist/docs/` прочитаны перед изменениями (CSP-гайд `01-app/02-guides/content-security-policy.md` — полностью).

---

## A. Сломанный тест bulk-download (аудит F1, P1) — ИСПРАВЛЕН

**Проблема:** `src/lib/server-zip-download.test.ts:221` падал с `TypeError: ...neq is not a function`: роут `src/app/api/client/orders/[orderId]/deliverables/bulk-download/route.ts:78` в PR #355 получил `.neq("status","pending_review")` в цепочке запроса `deliverable_reviews`, а мок Supabase (класс `Query`) метод `neq()` не реализовывал — цепочка обрывалась до `.order()`.

**Изменение:**
- `src/lib/server-zip-download.test.ts:137-139` — в класс `Query` после `eq()` добавлен минимальный метод:

  До: `select() / eq() / order() / maybeSingle()`
  После: `select() / eq() / neq() { return this; } / order() / maybeSingle()`

Структура теста, фикстуры и хуки загрузки модулей не тронуты (минимальная правка по KISS).

**Результат:** тест проходит — `node --experimental-strip-types --test src/lib/server-zip-download.test.ts` → 2/2 PASS.

---

## B. Осиротевшие тест-файлы (аудит F2/F3, P1) — ПОДКЛЮЧЕНЫ, СЛОМАННЫЕ ПОЧИНЕНЫ

### B1. Полный пересмотр списка сирот

Пересканированы все `*.test.ts / *.test.tsx / *.test.mjs` в `src/`, `scripts/`, `e2e/` и сверены с `package.json` (учтён glob `src/features/property-showcase/*.test.ts` в `test:property-showcase` — эти 41 файл формально сиротами не являются). Реально сиротских файлов — **15** (на 8 больше, чем в аудите: аудит нашёл 10 + `deliverable-rework-submit` и `seo-audit.test.mjs`; дополнительно найдены `before-after-alt`, `client-job-image-navigation`, `order-image-navigation`, `finalization-attempts`, `order-draft-finalization-client`).

### B2. Статус каждого ранее-осиротевшего теста (прямой прогон до подключения)

| Тест-файл | Прогон | Статус | Действие |
|---|---|---|---|
| `src/lib/admin-login.test.ts` | 12/12 | работал | подключён как есть |
| `src/lib/rework-submission.test.ts` | 25/25 | работал | подключён как есть |
| `src/lib/private-image-preview-routes.test.ts` | 6/6 | работал | подключён как есть |
| `src/lib/server-zip-download.test.ts` | 1/2 → 2/2 | **сломан (F1)** | починен мок (см. A), подключён |
| `src/lib/admin-replacement-route.test.ts` | 125/125 | работал | подключён как есть |
| `src/lib/admin-replacement-upload-client.test.ts` | 10/10 | работал | подключён как есть |
| `src/components/dashboard/deliverable-rework-submit.test.ts` | 7/7 | работал | подключён как есть |
| `src/lib/private-image-preview.test.ts` | падал при загрузке модуля → 9/9 | **сломан (F3)** | починена инвокация: тест импортирует `server-only`-модули, добавлен `--conditions=react-server` в скрипт (без правок самого теста) |
| `scripts/backfill-private-image-previews.test.ts` | падал при загрузке модуля → 2/2 | **сломан (F3)** | то же: `--conditions=react-server` в скрипте, тест не менялся |
| `scripts/seo-audit.test.mjs` | 16/16 | работал | подключён как есть |
| `src/lib/before-after-alt.test.ts` | 13/13 | работал | подключён как есть |
| `src/lib/client-job-image-navigation.test.ts` | 4/4 | работал | подключён как есть |
| `src/lib/order-image-navigation.test.ts` | 11/11 | работал | подключён как есть |
| `src/lib/order-drafts/finalization-attempts.test.ts` | 61/61 | работал | подключён как есть |
| `src/lib/order-drafts/order-draft-finalization-client.test.ts` | 24/24 | работал | подключён как есть |

**Итого: починено 3 файла** (1 — обновление мока под изменение роута, 2 — флаг инвокации `--conditions=react-server`), **12 работали как есть**. Все 15 теперь подключены.

### B3. Подключение к npm-скриптам

- `package.json:73` — новый скрипт **`test:coverage`**: один прогон `node --experimental-strip-types --test` для 13 файлов (в стиле существующих скриптов проекта) + второй прогон с `--conditions=react-server` для двух `server-only`-зависимых файлов — по образцу существующих `test:dashboard-navigation` и `media:backfill:*`, которые уже используют этот флаг.
- `package.json:71` — в конец существующей `&&`-цепочки **`test:ci`** добавлен `&& npm run test:coverage` (структуру монолитной цепочки не менял — её разбиение вне утверждённого объёма, аудит F17).
- Структура тестов не менялась; ни один тест-файл не переименован и не перемещён.

**Результат:** `npm run test:coverage` → 316 + 11 = **327 PASS / 0 FAIL**.

---

## C. Env-доки (аудит F6, P2) — ДОПОЛНЕНЫ

**Сверка полноты:** `grep -rhoE "process\.env\.[A-Z_0-9]+" src/ scripts/` (+ проверка деструктурированных/скобочных чтений и `e2e/`). Найденные переменные, отсутствовавшие в `.env.example` и таблице README:

| Переменная | Где читается | Назначение |
|---|---|---|
| `GEMINI_API_KEY` | `src/lib/support-assistant/gemini-transport.ts:16` | без неё AI-ассистент поддержки недоступен (degrade, не падение сайта) |
| `FROM_EMAIL` | `src/lib/email/resend-client.ts:52` | адрес «From» транзакционной почты; опциональна (fallback `orders@picchuspot.com`) |
| `NEXT_PUBLIC_GA_MEASUREMENT_ID` | `src/components/analytics/GoogleAnalytics.tsx:16` | GA4 page-view; опциональна (пусто = аналитика выключена) |
| `SUPPORT_RATE_LIMIT_SECRET` | `src/lib/support-assistant/rate-limit.ts:118`, `ip.ts:47-51` | HMAC-хэш идентичности для rate-limit ассистента; ≥32 символов, fail-closed |
| `PROPERTY_SHOWCASE_TRUSTED_FRAME_ORIGINS` | `src/features/property-showcase/provider-urls.ts:106` | опциональный allowlist iframe-провайдеров; не секрет |

`TURNSTILE_SECRET_KEY` (упомянут в `.env.example`, читается через дефолтный параметр `env` в `property-lead-security.ts:151`) уже документирован в обоих файлах — трогать не требовалось.

**Изменения:**
- `.env.example`: `FROM_EMAIL` (после `RESEND_API_KEY`, :18-22), `NEXT_PUBLIC_GA_MEASUREMENT_ID` (после `NEXT_PUBLIC_SITE_URL`, :43-44), блок «Support assistant» с `GEMINI_API_KEY` (:54-59) и `SUPPORT_RATE_LIMIT_SECRET` (:60-63), `PROPERTY_SHOWCASE_TRUSTED_FRAME_ORIGINS` (:68-71). Все значения — заглушки (`your-...-here`, `G-XXXXXXXXXX`, `replace-with-...`), реальных секретов нет.
- `README.md` (таблица Environment variables): добавлены те же 5 переменных (:33, :45-48) с колонками «Required for» / «Notes», согласованно с `.env.example`.

---

## D. CSP nonce (аудит F5, P2) — ОТСРОЧЕН, РЕШЕНИЕ ЗАДАКУМЕНТИРОВАНО В КОДЕ И ОТЧЁТЕ

**Прочитанный гайд этой версии:** `node_modules/next/dist/docs/01-app/02-guides/content-security-policy.md` — в Next.js 16 nonce ставится через **Proxy** (замена middleware, в проекте есть `src/proxy.ts`). При глобальной nonce-политике все страницы под этой политикой требуют **динамического рендеринга**: статическая генерация и ISR недоступны, CDN-кэширование требует отдельной настройки, статические shell'ы не получают nonce, PPR несовместим.

**Как CSP устроен сейчас:** статический CSP из `next.config.ts` (`headers()` на `/:path*`) → `CONTENT_SECURITY_POLICY_DIRECTIVES` в `src/lib/security-headers.ts` (`script-src 'self' 'unsafe-inline' ...`), политика жёстко закреплена тестом `src/lib/security-headers.test.ts` (19 тестов, `'nonce-` и `'strict-dynamic'` — запрещённые токены, т.е. это осознанная, задокументированная тестами политика).

**Почему внедрение nonce отложено (по п.4 гайда — риск сломать прод велик):**

1. **Компромисс (nonce + `'unsafe-inline'` fallback) не разрешает произвольные инлайн-скрипты в CSP3.** Браузеры **игнорируют `'unsafe-inline'`**, если в той же директиве есть `'nonce-…'`. Инлайн-скриптам потребуется совпадающий nonce или разрешённый hash; один «fallback» их не сохранит.
2. **GA может получить серверный nonce; клиентский рендеринг этому не препятствует.** Динамический серверный layout может прочитать nonce через `headers()`, передать его параметром в `GoogleAnalytics`, а компонент — в оба `<Script>` (инлайн-бутстрап с `dangerouslySetInnerHTML` и внешний GA-скрипт). Это поддерживает установленная версия Next.js. Первоначальное утверждение, что nonce «не доезжает» после гидрации, исправлено. Совместимость внедряемых Crisp скриптов и стилей требует отдельной проверки: `'strict-dynamic'` разрешает внешние скрипты, созданные без участия HTML-парсера, но не разрешает автоматически инлайн-блоки или стили. Отсрочка не основана на доказанной несовместимости GA/Crisp с nonce.
3. **Глобальная nonce-политика требует смены модели рендеринга и кэширования.** Для контентного сайта (gallery, pricing, blog, property showcase) потребуется отказаться от статической генерации и ISR на затронутых страницах, отдельно спроектировать CDN-кэширование и проверить производительность. Проверка требует `next build` и браузерных сценариев аналитики/чата; миграция рендеринга и интеграций выходит за объём исправлений A–D.
4. Альтернатива из гайда — экспериментальный SRI (hash-based CSP, сохраняет статику) — помечена как experimental и тоже требует проверки билдом.

**Изменение (документирующее, без изменения поведения CSP):**
- `src/lib/security-headers.ts` — перед `CONTENT_SECURITY_POLICY_DIRECTIVES` добавлен комментарий-план полного перехода: 1) Proxy на page-роуты с per-request nonce + `'strict-dynamic'` на request/response; 2) динамический рендеринг страниц под этой политикой и пересмотр кэширования; 3) передача nonce из серверного layout через параметры `GoogleAnalytics` в оба `<Script>` и отдельная проверка авторизации скриптов/стилей Crisp; 4) переработка security-headers тестов и проверка реальным `next build` + прод-smoke перед снятием `'unsafe-inline'`; упомянута экспериментальная SRI-альтернатива.

Основание уточнения: [официальный пример передачи nonce в Next.js](https://nextjs.org/docs/app/guides/content-security-policy#reading-the-nonce), установленный `next/dist/client/script.js` (передача `nonce` в клиентский загрузчик) и [CSP3: правила инлайн-блоков](https://www.w3.org/TR/CSP3/#match-element-to-source-list).

Само значение CSP не изменено — политика и все 19 тестов `test:security-headers` остаются в исходном состоянии (19/19 PASS). Прод не сломан, билд не тронут.

---

## Результаты первоначальных проверок на базе `f46def8`

| Проверка | Результат |
|---|---|
| `npm run lint` | **0 ошибок, 25 предупреждений** — ровно уровень аудита (16 — шум `.zcode/`, 9 — `no-location-assign-relative-destination`), не хуже |
| `npm run typecheck:test` | **PASS** (exit 0) |
| `npm run test:pricing` | **PASS 72/72** |
| `npm run test:order-drafts` | **PASS 108/108** |
| `npm run test:coverage` (новый) | **PASS 316 + 11 = 327/327** |
| `npm run test:security-headers` (после правки D) | **PASS 19/19** |
| Playwright e2e | не запускался (по ограничению задачи) |
| `next build` | не запускался (по ограничению задачи); CSP-верификация — статическая, по коду и гайду версии |

## Повторные локальные проверки после переноса на актуальную `main`

Проверки выполнены на `fix/unlimited-use-pass` после переноса исправлений на `e867292` и уточнения nonce-комментария, с Node.js 24.18.0 и `CI=1`. `package-lock.json` совпадает с исходным состоянием: зависимости не менялись.

| Проверка | Результат |
|---|---|
| `npm run test:ci` | **PASS 2883/2883**, без пропущенных, отменённых или упавших тестов |
| `test:coverage` внутри `test:ci` | **PASS 316 + 11 = 327/327** |
| `test:pricing` / `test:order-drafts` / `test:security-headers` внутри `test:ci` | **PASS 72/72 · 108/108 · 19/19** |
| `npm run typecheck:test` | **PASS** (exit 0) |
| `npm run lint` | **0 ошибок, 25 предупреждений**, как при первоначальной проверке |
| `git diff --check` | **PASS** |
| Состав изменений относительно `origin/main` | Только семь файлов из `90a2971`, с уточнением комментария и этого отчёта |
| Галерея, sitemap, Supabase-клиент и workflow CI | Без изменений относительно актуальной `main` |

В первоначальном ревью старой основы было 2887 unit-тестов. Разница в четыре теста обусловлена самой `main`: там уже удалён `src/lib/gallery-sitemap.test.ts` (четыре теста) и добавлен `e2e/partner-invites/gallery-sitemap.spec.ts`. Группа `test:seo` теперь содержит 19 вместо 23 тестов. Переносимые 15 файлов и их 327 тестов сохранены полностью.

Это повторный прогон локальных unit-проверок CI, lint и проверки типов. `next build` и Playwright на этом шаге не запускались; новые браузерные сценарии sitemap не входят в число 2883. GitHub Actions не запускался: ветка подготовлена локально, без push, слияния и деплоя.

## Изменённые файлы

- `src/lib/server-zip-download.test.ts` — мок `Query`: метод `neq()` (:137-139)
- `package.json` — скрипт `test:coverage` (:73), `&& npm run test:coverage` в `test:ci` (:71)
- `.env.example` — 5 переменных с описаниями (:18-22, :43-44, :54-63, :68-71)
- `README.md` — 5 строк в таблице Environment variables (:33, :45-48)
- `src/lib/security-headers.ts` — комментарий-план миграции nonce, значение CSP без изменений
- `UNLIMITED-USE-AUDIT-2026-11-06.md` (из аудита, включён в коммит), `UNLIMITED-USE-FIXES-2026-11-06.md` (этот отчёт)

## Риски / отложенное

- CSP nonce отложен с планом (см. D) — это осознанное решение, а не пропуск.
- `test:ci` теперь прогоняет 327 тестов сирот — если какой-то сломается, падает вся цепочка (существующее поведение `test:ci`, разбиение — F17 вне объёма).
- Список env сверён только по `src/` + `scripts/`; переменные вроде `F8_POSTGRES_BIN_DIR`/`PLAYWRIGHT_*` (тестовые/инфраструктурные) в доках сознательно не добавлялись — они не относятся к прод-чеклисту деплоя.
