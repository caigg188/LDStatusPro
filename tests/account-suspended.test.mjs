import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync(new URL('../LDStatusPro.user.js', import.meta.url), 'utf8');

function sliceBetween(startMarker, endMarker) {
    const start = source.indexOf(startMarker);
    assert.ok(start >= 0, `missing start marker: ${startMarker}`);
    const end = source.indexOf(endMarker, start);
    assert.ok(end > start, `missing end marker after ${startMarker}`);
    return source.slice(start, end);
}

test('a suspension is routed to its own handler instead of the session-expired path', () => {
    const apiCatch = sliceBetween('const errCode = String(e?.code || \'\').trim().toUpperCase();', 'if (token && isAuthError) {');
    assert.match(apiCatch, /errCode === 'ACCOUNT_SUSPENDED'/, 'need an explicit branch before auth-error detection');
    assert.match(apiCatch, /this\._handleAccountSuspended\(e\?\.details\)/);
    assert.match(apiCatch, /throw e;/, 'the original error must still surface to the caller');
    assert.doesNotMatch(apiCatch.split("errCode === 'ACCOUNT_SUSPENDED'")[0], /_handleAuthExpired/,
        'suspension must not be handled by the expiry branch');
});

test('the suspension handler keeps the session and only publishes state', () => {
    const handler = sliceBetween('_handleAccountSuspended(details = {}) {', '_handleAuthExpired(');
    assert.match(handler, /EventBus\.emit\('account:suspended'/);
    assert.doesNotMatch(handler, /logout\(/, 'a suspended account keeps its token so the panel can explain why');
    assert.match(handler, /scopes: Array\.isArray\(details\?\.scopes\)/);
});

test('the API error carries reason and expiry for the UI to render', () => {
    const requestError = sliceBetween('const err = new Error(errorCode ?', 'reject(err);');
    assert.match(requestError, /if \(data\.error\?\.details\) err\.details = data\.error\.details;/);
});

test('the panel replaces its content with the suspension card and escapes operator text', () => {
    assert.match(source, /renderAccountSuspended\(status = \{\}\) \{/);
    const card = sliceBetween('renderAccountSuspended(status = {}) {', 'renderLeaderboardLogin(');
    assert.match(card, /账号已被平台封禁/);
    assert.match(card, /Utils\.escapeHtml\(reason\)/, 'reason is operator-supplied text');
    assert.match(card, /Utils\.escapeHtml\(untilText\)/);

    const content = sliceBetween('async _renderLeaderboardContent() {', 'if (!logged) {');
    assert.match(content, /if \(logged && this\.accountSuspended\)/);
    assert.match(content, /renderAccountSuspended\(this\.accountSuspended\)/);
});

test('the status endpoint keeps the panel in sync without a hard refresh', () => {
    const prefs = sliceBetween('async _syncPrefs() {', '// ========== 我的活动 ==========');
    assert.match(prefs, /result\.data\.accountStatus/);
    assert.match(prefs, /accountStatus\.scopes\?\.includes\('login'\)/);
    assert.match(prefs, /suspensionChanged/);
    assert.match(prefs, /request !== this\._accountStatusRequest/);
});

test('the suspension error is formatted with the operator reason instead of a generic 403', () => {
    const formatter = sliceBetween('format(error) {', '// 2. 检查消息中的关键词');
    assert.match(formatter, /code === 'ACCOUNT_SUSPENDED'/);
    assert.match(formatter, /账号已被平台封禁/);
});
