import assert from 'node:assert/strict';
import test from 'node:test';
import { PAGE_PATHS, REQUEST_PATHS, parseOptions, canonicalFor, sameURL, googleRestrictions, analyzePage, analyzeSite, getPublicResource, reportExitCode } from './seo-audit.mjs';

function page(path = '/pricing/virtual-staging', changes = {}) {
  return {
    path, status: 200, contentType: 'text/html; charset=utf-8', bytes: 1000,
    xRobotsTag: '', robots: ['index, follow'], titles: ['Virtual Staging | PicchuSpot'],
    descriptions: ['Professional virtual staging.'], h1: ['Virtual staging'], lang: 'en',
    canonicals: [canonicalFor(path)], jsonLd: ['{"@type":"Service"}'],
    alternates: [{ lang: 'en', href: canonicalFor(path) }, { lang: 'es', href: canonicalFor(`/es${path}`) }],
    links: [], ...changes,
  };
}

test('loopback is default; production is explicit; arbitrary targets are rejected', () => {
  assert.equal(parseOptions([]).baseURL, 'http://127.0.0.1:3100');
  assert.equal(parseOptions(['--base-url', 'https://picchuspot.com', '--production']).production, true);
  for (const args of [
    ['--base-url', 'https://picchuspot.com'], ['--production'],
    ['--base-url', 'https://example.com', '--production'],
    ['--base-url', 'https://www.picchuspot.com', '--production'],
    ['--base-url', 'http://127.0.0.1:3100/dashboard'],
    ['--base-url', 'http://user:pass@localhost'], ['--base-url', 'http://localhost?q=1'],
    ['--base-url', 'file:///tmp'], ['--base-url'], ['--out', '--gate'], ['--unknown'],
    ['--gate', '--gate'], ['--base-url', 'http://localhost', '--base-url', 'http://localhost'],
  ]) assert.throws(() => parseOptions(args), undefined, JSON.stringify(args));
});

test('scope is bounded and excludes protected routes, queries and local SEO', () => {
  assert.equal(PAGE_PATHS.length, 15);
  assert.equal(new Set(REQUEST_PATHS).size, REQUEST_PATHS.length);
  for (const path of REQUEST_PATHS) assert.doesNotMatch(path, /dashboard|admin|api|login|signup|order|local|[?#]/);
});

test('well-formed page has no findings', () => assert.deepEqual(analyzePage(page()), []));

test('URL comparison normalizes root trailing slash but preserves meaningful URL differences', () => {
  assert.equal(sameURL('https://picchuspot.com', 'https://picchuspot.com/'), true);
  assert.equal(sameURL('https://picchuspot.com?x=1', 'https://picchuspot.com/'), false);
  assert.equal(sameURL('https://picchuspot.com/es', 'https://picchuspot.com/es/'), false);
  const root = page('/', {
    canonicals: ['https://picchuspot.com'],
    alternates: [
      { lang: 'en', href: 'https://picchuspot.com' },
      { lang: 'es', href: 'https://picchuspot.com/es' },
    ],
  });
  assert.ok(!analyzePage(root).some((item) => item.id === 'HREFLANG_PAIR'));
  assert.ok(!analyzeSite([root], ['https://picchuspot.com']).some((item) => item.id === 'SITEMAP_MISSING'));
});

test('noindex/none are P0; other bot directives are not Google directives', () => {
  for (const robots of [['noindex, follow'], ['none']]) assert.ok(analyzePage(page(undefined, { robots })).some((item) => item.id === 'NOINDEX' && item.priority === 'P0'));
  assert.deepEqual(googleRestrictions('bingbot: noindex, nofollow', true), []);
  assert.deepEqual(googleRestrictions('googlebot: nofollow, noindex', true), ['noindex']);
  assert.deepEqual(googleRestrictions('max-snippet: 0, noindex', true), ['nosnippet', 'noindex']);
  assert.deepEqual(googleRestrictions('bingbot: noindex, googlebot: nosnippet', true), ['nosnippet']);
  assert.deepEqual(googleRestrictions('max-snippet: -1'), []);
});

test('snippets are a separate P1, not non-indexation', () => {
  const findings = analyzePage(page(undefined, { robots: ['max-snippet:0'] }));
  assert.ok(findings.some((item) => item.id === 'SNIPPET_RESTRICTED' && item.priority === 'P1'));
  assert.ok(!findings.some((item) => item.id === 'NOINDEX'));
});

test('canonical gate catches missing, duplicate, malformed, cross-page and query targets', () => {
  for (const canonicals of [[], ['https://picchuspot.com/'], ['http://['], [canonicalFor('/pricing/virtual-staging') + '?x=1'], [canonicalFor('/pricing/virtual-staging'), canonicalFor('/pricing/virtual-staging')]]) {
    assert.ok(analyzePage(page(undefined, { canonicals })).some((item) => item.id === 'CANONICAL' && item.priority === 'P0'));
  }
  const findings = analyzePage(page(undefined, { canonicals: ['/pricing/virtual-staging'] }));
  assert.ok(findings.some((item) => item.id === 'RELATIVE_CANONICAL'));
  assert.ok(!findings.some((item) => item.priority === 'P0'));
});

test('Spanish lang mismatch stays visible without asserting a ranking penalty or blocking P0', () => {
  const findings = analyzePage(page('/es/pricing/virtual-staging', {
    alternates: [{ lang: 'en', href: canonicalFor('/pricing/virtual-staging') }, { lang: 'es', href: canonicalFor('/es/pricing/virtual-staging') }],
  }));
  assert.deepEqual(findings.map(({ id, priority }) => ({ id, priority })), [{ id: 'HTML_LANGUAGE', priority: 'P2' }]);
});

test('English-only blog and relevant service link are checked', () => {
  const path = '/blog/virtual-staging-cost';
  assert.deepEqual(analyzePage(page(path, { alternates: [], links: ['/pricing/virtual-staging'] })), []);
  assert.ok(analyzePage(page(path, { alternates: [] })).some((item) => item.id === 'SUPPORTING_SERVICE_LINK'));
  assert.ok(analyzePage(page(path)).some((item) => item.id === 'ENGLISH_ONLY_ALTERNATES'));
});

test('hreflang mismatch is P1; multiple H1 is only a review warning', () => {
  const findings = analyzePage(page(undefined, { alternates: [], h1: ['A', 'B'] }));
  assert.ok(findings.some((item) => item.id === 'HREFLANG_PAIR' && item.priority === 'P1'));
  assert.ok(findings.some((item) => item.id === 'H1_MULTIPLE' && item.priority === 'P3'));
});

test('HTTP failures do not proceed to metadata checks', () => {
  assert.equal(analyzePage({ path: '/', status: 404 })[0].id, 'PUBLIC_HTTP_STATUS');
  assert.equal(analyzePage({ path: '/', status: 403 })[0].priority, 'P1');
  assert.equal(analyzePage({ path: '/', status: 200, contentType: 'application/json' })[0].id, 'NOT_HTML');
});

test('invalid JSON-LD is found without treating schema absence as an indexing failure', () => {
  assert.ok(analyzePage(page(undefined, { jsonLd: ['{'] })).some((item) => item.id === 'JSON_LD_INVALID'));
  assert.ok(!analyzePage(page(undefined, { jsonLd: [] })).some((item) => item.priority === 'P0'));
});

test('site checks distinguish incomplete graph and unavailable sitemap from failed checks', () => {
  const pages = [page(undefined, { links: ['/pricing/floor-plans', '/unknown', 'https://example.com'] }), { path: '/pricing/floor-plans', status: 404 }];
  const findings = analyzeSite(pages, null);
  assert.ok(findings.some((item) => item.id === 'SAMPLED_INTERNAL_LINK'));
  assert.ok(!findings.some((item) => item.id === 'SITEMAP_MISSING' || item.evidence.includes('/unknown')));
  assert.ok(analyzeSite([page()], []).some((item) => item.id === 'SITEMAP_MISSING'));
});

test('requests are GET, bounded, cookieless and never follow redirects', async () => {
  let calls = 0;
  const fetcher = async (url, options) => {
    calls += 1;
    assert.equal(url.href, 'http://127.0.0.1:3100/pricing');
    assert.equal(options.method, 'GET'); assert.equal(options.redirect, 'manual');
    assert.equal(options.headers.Cookie, undefined); assert.equal(options.headers.Authorization, undefined);
    return new Response('', { status: 302, headers: { Location: 'https://example.com/private' } });
  };
  assert.equal((await getPublicResource('http://127.0.0.1:3100', '/pricing', fetcher)).status, 302);
  await assert.rejects(() => getPublicResource('http://127.0.0.1:3100', '/dashboard', fetcher));
  assert.equal(calls, 1);
});

test('oversized response is refused', async () => {
  await assert.rejects(() => getPublicResource('http://localhost', '/', async () => new Response('x'.repeat(2 * 1024 * 1024 + 1))), /exceeds/);
});

test('exit codes separate report-only warnings, P0 gates and incomplete execution', () => {
  const report = { complete: true, errors: [], findings: [{ priority: 'P0' }] };
  assert.equal(reportExitCode(report, false), 0); assert.equal(reportExitCode(report, true), 1);
  assert.equal(reportExitCode({ ...report, findings: [{ priority: 'P2' }] }, true), 0);
  assert.equal(reportExitCode({ ...report, complete: false }, false), 2);
  assert.equal(reportExitCode({ ...report, errors: ['network'] }, true), 2);
});
