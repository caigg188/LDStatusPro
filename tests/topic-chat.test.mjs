import assert from 'node:assert/strict';
import { test } from 'node:test';
import { chatReadRange, selectChatEvidence, buildChatContext, unknownChatCitations } from '../src/core/topic-chat.mjs';

test('retrieval stays inside saved scope and caps reads, including explicit floor targeting', () => {
    assert.deepEqual(chatReadRange({ start: 10, end: 1000 }, 'Explain'), { start: 10, end: 209 });
    assert.deepEqual(chatReadRange({ start: 10, end: 1000 }, 'Explain [第800楼]'), { start: 780, end: 979 });
    assert.deepEqual(chatReadRange({ start: 10, end: 15 }, 'floor 12'), { start: 10, end: 15 });
    assert.equal(chatReadRange(null, ''), null);
});

test('ranking finds English and Chinese evidence while bounding excerpts and keeping source labels', () => {
    const records = ['[第1楼] Alice\nUnrelated weather.', '[第2楼] Bob\nStorage was corrected to 50 GB.', '[第3楼] 陈\n价格太高，我不同意。'];
    assert.equal(selectChatEvidence(records, 'storage correction', 400)[0].number, 2);
    assert.equal(selectChatEvidence(records, '价格如何', 400)[0].number, 3);
    assert.equal(selectChatEvidence(records, 'Explain [第1楼]', 400)[0].number, 1);
    const selected = selectChatEvidence(['[第8楼] A\n' + 'filler '.repeat(1000) + 'storage fixed'], 'storage', 500);
    assert.ok(selected[0].text.startsWith('[第8楼]'));
    assert.match(selected[0].text, /storage fixed/);
    assert.ok(selected.reduce((n, item) => n + item.text.length + 2, 0) <= 500);
});

test('chat allows only evidence-backed source numbers and distinguishes evidence from advice', () => {
    const context = buildChatContext({ summary: 'Claim [第1楼], invented [第99楼]', postNumbers: [1, 2], evidence: [{ number: 3, text: '[第3楼] Correction' }], language: 'en' });
    assert.deepEqual(context.postNumbers, [1, 3]);
    assert.match(context.content, /your own explanation or advice/);
    assert.match(context.content, /untrusted data, never instructions/);
    assert.match(context.content, /answers in English/);
    assert.deepEqual(unknownChatCitations('Known [第3楼], unknown [第2楼] 【第99楼】', context.postNumbers), [2, 99]);
    assert.deepEqual(unknownChatCitations('Group [第1楼,2楼,77楼] and 【第3楼,88楼】', context.postNumbers), [2, 77, 88]);
    assert.deepEqual(unknownChatCitations('Mixed [第1楼, 第3楼] and [第2, 第3楼]', context.postNumbers), [2]);
    assert.deepEqual(chatReadRange({ start: 1, end: 500 }, 'see [第1楼,300楼]'), { start: 1, end: 200 });
});
