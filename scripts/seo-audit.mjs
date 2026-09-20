// Bounded, read-only public HTML audit. No discovery, login, JS hydration or API calls.
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';

export const CANONICAL_ORIGIN = 'https://picchuspot.com';
// Audit scope only; application routes/prices remain owned by the existing registries.
const bilingual = ['/', '/pricing', '/pricing/virtual-staging', '/pricing/floor-plans', '/pricing/photo-editing', '/pricing/virtual-renovation'];
export const PAGE_PATHS = Object.freeze([
  ...bilingual.flatMap((path) => [path, path === '/' ? '/es' : `/es${path}`]),
  '/blog', '/blog/virtual-staging-cost', '/blog/what-is-virtual-staging',
]);
export const REQUEST_PATHS = Object.freeze([...PAGE_PATHS, '/robots.txt', '/sitemap.xml']);
const MAX_BYTES = 2 * 1024 * 1024;

export function parseOptions(args) {
  const options = { baseURL: 'http://127.0.0.1:3100', out: 'test-results/seo-audit', production: false, gate: false };
  const seen = new Set();
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (seen.has(arg)) throw new Error(`Repeated option: ${arg}`);
    seen.add(arg);
    if (arg === '--production') options.production = true;
    else if (arg === '--gate') options.gate = true;
    else if (arg === '--base-url' || arg === '--out') {
      const value = args[++i];
      if (!value || value.startsWith('--')) throw new Error(`Missing value: ${arg}`);
      options[arg === '--base-url' ? 'baseURL' : 'out'] = value;
    } else throw new Error(`Unknown option: ${arg}`);
  }
  const url = new URL(options.baseURL);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
    throw new Error('Use a bare HTTP(S) origin without credentials, path, query or fragment.');
  }
  const local = ['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname);
  const production = url.origin === CANONICAL_ORIGIN;
  if ((!local && !production) || (production !== options.production)) {
    throw new Error('Only loopback or explicit --production --base-url https://picchuspot.com is permitted.');
  }
  options.baseURL = url.origin;
  return options;
}

export function canonicalFor(path) { return new URL(path, CANONICAL_ORIGIN).href; }

// Keep bot-scoped directives from another crawler from becoming a Google noindex finding.
export function googleRestrictions(value, header = false) {
  let applies = true;
  const found = [];
  for (let token of value.toLowerCase().split(',')) {
    token = token.trim();
    const scope = token.match(/^([\w-]+):\s*(.*)$/);
    if (header && scope && !['max-snippet', 'max-image-preview', 'max-video-preview', 'unavailable_after'].includes(scope[1])) {
      applies = scope[1] === 'googlebot';
      token = scope[2];
    }
    if (!applies) continue;
    if (/(?:^|\s)(noindex|none)(?:\s|$)/.test(token)) found.push('noindex');
    if (/^nosnippet$|^max-snippet:\s*0$/.test(token)) found.push('nosnippet');
  }
  return found;
}

export function analyzePage(page) {
  const findings = [];
  const add = (id, priority, evidence) => findings.push({ id, priority, path: page.path, evidence });
  if (page.status !== 200) {
    // This is an observed HTTP result, not proof of Google's indexing state.
    add('PUBLIC_HTTP_STATUS', [401, 403, 429].includes(page.status) ? 'P1' : 'P0', `Observed HTTP ${page.status}; redirects were not followed.`);
    return findings;
  }
  if (!page.contentType.toLowerCase().includes('text/html')) {
    add('NOT_HTML', 'P0', `Expected HTML; received ${page.contentType || 'no Content-Type'}.`);
    return findings;
  }
  const restrictions = [
    ...googleRestrictions(page.xRobotsTag || '', true),
    ...page.robots.flatMap((value) => googleRestrictions(value)),
  ];
  if (restrictions.includes('noindex')) add('NOINDEX', 'P0', 'Google-applicable noindex/none directive on an intended public page.');
  if (restrictions.includes('nosnippet')) add('SNIPPET_RESTRICTED', 'P1', 'nosnippet or max-snippet:0; review intended Google AI eligibility.');
  const expected = canonicalFor(page.path);
  let canonicalMatches = false;
  if (page.canonicals.length === 1) {
    try { canonicalMatches = new URL(page.canonicals[0], expected).href === expected; } catch { /* invalid canonical */ }
  }
  if (!canonicalMatches) add('CANONICAL', 'P0', `Expected one self-canonical ${expected}; observed ${JSON.stringify(page.canonicals)}.`);
  else if (!/^https:\/\//i.test(page.canonicals[0])) add('RELATIVE_CANONICAL', 'P2', 'Prefer an absolute canonical; relative target currently resolves correctly.');
  if (page.titles.length !== 1 || !page.titles[0]) add('TITLE', 'P1', 'Expected one non-empty title.');
  if (!page.h1.some(Boolean)) add('H1_MISSING', 'P1', 'No non-empty H1 in server HTML.');
  else if (page.h1.length > 1) add('H1_MULTIPLE', 'P3', 'Review heading structure; multiple H1s are not automatically a ranking defect.');
  if (page.descriptions.length !== 1 || !page.descriptions[0]) add('DESCRIPTION', 'P2', 'Review missing/duplicate meta description.');
  const language = page.path === '/es' || page.path.startsWith('/es/') ? 'es' : 'en';
  if (page.lang.toLowerCase().split('-')[0] !== language) add('HTML_LANGUAGE', 'P2', `Expected ${language}; observed ${page.lang || '(missing)'}. Accessibility/language consistency, not proof of ranking loss.`);
  if (page.bytes > 750 * 1024) add('HTML_WEIGHT', 'P2', `${page.bytes} response-body bytes; investigate before changing delivery.`);
  for (const value of page.jsonLd) {
    try {
      const parsed = JSON.parse(value);
      if (!parsed || typeof parsed !== 'object') throw new Error('Not an object/array');
    } catch { add('JSON_LD_INVALID', 'P2', 'Invalid JSON-LD; inspect source. This check is not schema.org validation.'); }
  }
  const english = language === 'es' ? (page.path === '/es' ? '/' : page.path.slice(3)) : page.path;
  if (bilingual.includes(english)) {
    const spanish = english === '/' ? '/es' : `/es${english}`;
    for (const [lang, target] of [['en', english], ['es', spanish]]) {
      const alternates = page.alternates.filter((item) => item.lang.toLowerCase() === lang);
      if (alternates.length !== 1 || alternates[0].href !== canonicalFor(target)) add('HREFLANG_PAIR', 'P1', `Expected ${lang} alternate ${canonicalFor(target)}.`);
    }
  } else if (page.alternates.length) add('ENGLISH_ONLY_ALTERNATES', 'P1', 'These registered blog routes have no published Spanish counterpart; inspect unexpected hreflang.');
  if (page.path.startsWith('/blog/') && !page.links.some((href) => {
    try { return new URL(href, expected).href === canonicalFor('/pricing/virtual-staging'); } catch { return false; }
  })) add('SUPPORTING_SERVICE_LINK', 'P1', 'No link from the sampled Virtual Staging article to its service page.');
  return findings;
}

export function analyzeSite(pages, sitemapURLs) {
  const findings = pages.flatMap(analyzePage);
  const add = (id, priority, path, evidence) => findings.push({ id, priority, path, evidence });
  const titles = new Map();
  for (const page of pages.filter((item) => item.status === 200 && item.titles)) {
    const title = page.titles[0];
    if (title && titles.has(title)) add('DUPLICATE_TITLE', 'P2', page.path, `Same title as ${titles.get(title)} within the sample.`);
    else if (title) titles.set(title, page.path);
    if (sitemapURLs && !sitemapURLs.includes(canonicalFor(page.path))) add('SITEMAP_MISSING', 'P2', page.path, 'Not found in the fetched URL-set sitemap. Absence is not proof of non-indexation.');
    const seen = new Set();
    for (const href of page.links) {
      let url;
      try { url = new URL(href, canonicalFor(page.path)); } catch { continue; }
      if (url.origin !== CANONICAL_ORIGIN || seen.has(url.pathname)) continue;
      seen.add(url.pathname);
      const target = pages.find((item) => item.path === url.pathname);
      if (target && target.status !== 200) add('SAMPLED_INTERNAL_LINK', target.status >= 400 ? 'P1' : 'P2', page.path, `Links to ${target.path}, observed HTTP ${target.status}. No links outside the allowlist were fetched.`);
    }
  }
  return findings;
}

// Executed in an offline browser document, never in the production page context.
export function extractDocument(html) {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const texts = (selector) => Array.from(doc.querySelectorAll(selector), (node) => (node.textContent || '').trim());
  const attributes = (selector, attribute) => Array.from(doc.querySelectorAll(selector), (node) => node.getAttribute(attribute) || '');
  return {
    lang: doc.documentElement.lang || '',
    titles: texts('title'), h1: texts('h1'),
    descriptions: attributes('meta[name="description" i]', 'content'),
    canonicals: attributes('link[rel~="canonical" i]', 'href'),
    robots: attributes('meta[name="robots" i], meta[name="googlebot" i]', 'content'),
    alternates: Array.from(doc.querySelectorAll('link[rel~="alternate" i][hreflang]'), (node) => ({ lang: node.getAttribute('hreflang') || '', href: node.getAttribute('href') || '' })),
    jsonLd: texts('script[type="application/ld+json" i]'),
    links: attributes('a[href]', 'href'),
  };
}

export async function getPublicResource(origin, path, fetcher = fetch) {
  if (!REQUEST_PATHS.includes(path)) throw new Error(`Path outside the audit allowlist: ${path}`);
  const response = await fetcher(new URL(path, origin), {
    method: 'GET', redirect: 'manual', signal: AbortSignal.timeout(10000),
    headers: { 'User-Agent': 'PicchuSpot-SEO-Audit/1.0', Accept: 'text/html,application/xml,text/plain' },
  });
  const reader = response.body?.getReader();
  const chunks = [];
  let bytes = 0;
  if (reader) {
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        bytes += value.byteLength;
        if (bytes > MAX_BYTES) throw new Error(`Response exceeds ${MAX_BYTES} bytes: ${path}`);
        chunks.push(Buffer.from(value));
      }
    } finally { await reader.cancel().catch(() => {}); }
  }
  return { path, status: response.status, contentType: response.headers.get('content-type') || '', xRobotsTag: response.headers.get('x-robots-tag') || '', bytes, body: Buffer.concat(chunks).toString('utf8') };
}

export function reportExitCode(report, gate) {
  if (report.errors.length || !report.complete) return 2;
  return gate && report.findings.some((item) => item.priority === 'P0') ? 1 : 0;
}

async function saveReport(report, out) {
  await mkdir(out, { recursive: true });
  await writeFile(resolve(out, 'seo-audit.json'), `${JSON.stringify(report, null, 2)}\n`);
  const safe = (value) => String(value).replace(/[\r\n]+/g, ' ').replaceAll('|', '\\|').slice(0, 1200);
  const rows = report.findings.map((item) => `| ${item.priority} | ${safe(item.path)} | ${item.id} | ${safe(item.evidence)} |`);
  const text = [
    '# PicchuSpot public HTML audit', '',
    `UTC: ${report.checkedAt} | Target: ${report.baseURL}`,
    `Coverage: ${report.pages.length}/${PAGE_PATHS.length} page responses; complete=${report.complete}.`,
    'Read-only initial HTML sample. Not an indexing report, full-site crawl, hydrated-UI test, CWV measurement or GEO score.', '',
    '| Priority | Path | Check | Evidence |', '| --- | --- | --- | --- |', ...rows, '',
    '## Tooling / coverage errors', ...report.errors.map((error) => `- ${safe(error)}`), '',
    '## Still requires review', ...report.manualChecks.map((check) => `- ${check}`), '',
  ].join('\n');
  await writeFile(resolve(out, 'seo-audit.md'), text);
}

export async function runAudit(options) {
  const report = {
    version: 1, checkedAt: new Date().toISOString(), baseURL: options.baseURL,
    complete: false, pages: [], findings: [], errors: [], robots: null, sitemap: null,
    manualChecks: [
      'Actual indexation and Google-selected canonical: GSC URL Inspection, not HTTP 200.',
      'robots.txt crawler-specific rules, HTTP Link canonicals and CDN/WAF access for genuine crawlers.',
      'Links outside the sample, full graph/orphans, images, JS hydration and field Core Web Vitals.',
      'Visible offer versus authoritative pricing/terms and structured data; no automatic price changes.',
      'Commercial intent, first-party examples, independent references and topic overlap.',
      'GSC/GA4 outcomes and sampled AI citations; missing measurements are not zero.',
    ],
  };
  let browser;
  let sitemapURLs = null;
  try {
    const { chromium } = await import('@playwright/test');
    browser = await chromium.launch({ channel: 'chromium', headless: true });
    const context = await browser.newContext({ javaScriptEnabled: false, serviceWorkers: 'block' });
    await context.route('**/*', (route) => route.abort());
    const parser = await context.newPage();
    for (const path of REQUEST_PATHS) {
      try {
        const result = await getPublicResource(options.baseURL, path);
        if (PAGE_PATHS.includes(path)) {
          const data = result.status === 200 && result.contentType.toLowerCase().includes('text/html') ? await parser.evaluate(extractDocument, result.body) : {};
          const { body: _body, ...metadata } = result;
          void _body;
          report.pages.push({ ...metadata, ...data });
          if ([401, 403, 429].includes(result.status)) report.errors.push(`${path}: HTTP ${result.status}; cannot establish page state behind this response.`);
        } else if (path === '/robots.txt') {
          report.robots = { status: result.status, text: result.body.slice(0, 65536) };
          if (![200, 404].includes(result.status)) report.errors.push(`robots.txt: HTTP ${result.status}; review unavailable crawl controls.`);
        } else {
          report.sitemap = { status: result.status, urls: [] };
          if (result.status !== 200) report.errors.push(`sitemap.xml: HTTP ${result.status}; sitemap coverage not checked.`);
          else {
            sitemapURLs = await parser.evaluate((xml) => {
              const doc = new DOMParser().parseFromString(xml, 'application/xml');
              if (doc.querySelector('parsererror') || doc.documentElement.localName !== 'urlset') return null;
              return Array.from(doc.getElementsByTagNameNS('*', 'loc'), (node) => (node.textContent || '').trim());
            }, result.body);
            report.sitemap.urls = sitemapURLs || [];
            if (!sitemapURLs) report.errors.push('sitemap.xml is not a valid URL-set; sitemap indexes are deliberately not followed.');
          }
        }
      } catch (error) { report.errors.push(`${path}: ${error instanceof Error ? error.message : String(error)}`); }
      if (options.production) await delay(1000);
    }
  } catch (error) { report.errors.push(`Audit setup: ${error instanceof Error ? error.message : String(error)}`); }
  finally { if (browser) await browser.close(); }
  report.findings = analyzeSite(report.pages, sitemapURLs);
  report.complete = report.errors.length === 0 && report.pages.length === PAGE_PATHS.length;
  await saveReport(report, options.out);
  return report;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const options = parseOptions(process.argv.slice(2));
    const report = await runAudit(options);
    console.log(`SEO audit: ${report.pages.length}/${PAGE_PATHS.length} page responses; ${report.findings.length} findings; ${report.errors.length} coverage errors. Reports: ${options.out}`);
    process.exitCode = reportExitCode(report, options.gate);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 2;
  }
}
