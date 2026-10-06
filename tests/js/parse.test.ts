import { test } from "node:test";
import assert from "node:assert/strict";
import { parseBalances, parseJar, parseReplies } from "../../src/lib/parse.ts";

const JAR = '{"jar_id": "0a62", "creator": "0xabc", "title": "T", "tip_wei": "1000000000000000", "state": "OPEN", "comment_count": 2, "praised_count": 1, "tipped_total": "1000000000000000", "reply_count": 2}';

test("views are parsed as JSON once, or twice when the RPC double-encodes them", () => {
  assert.equal(parseJar(JAR)?.tip_wei, "1000000000000000");
  assert.equal(parseJar(JSON.stringify(JAR))?.praised_count, 1);
});

test("amounts stay decimal strings, including ones beyond 2^53", () => {
  const b = parseBalances('{"wallet": "0xabc", "allowance": "9999999999999999999000000000000000", "earnings": "0"}');
  assert.equal(b?.allowance, "9999999999999999999000000000000000");
});

test("unknown id, broken JSON or a numeric amount read as nothing", () => {
  assert.equal(parseJar("{}"), null);
  assert.equal(parseJar("not json"), null);
  assert.equal(parseBalances('{"allowance": 5, "earnings": "0"}'), null);
  assert.deepEqual(parseReplies("{}"), { total: 0, replies: [] });
});

test("replies keep outcome and tip_moved as written", () => {
  const p = parseReplies('{"jar_id": "a", "offset": 0, "limit": 50, "total": 2, "replies": [{"index": 0, "jar_id": "a", "author": "0xc", "text": "x", "outcome": "NOT_PRAISE", "tip_moved": "0"}, {"index": 1, "jar_id": "a", "author": "0xb", "text": "y", "outcome": "SINCERE_PRAISE", "tip_moved": "1000000000000000"}]}');
  assert.equal(p.total, 2);
  assert.deepEqual(p.replies.map((r) => [r.outcome, r.tip_moved]), [["NOT_PRAISE", "0"], ["SINCERE_PRAISE", "1000000000000000"]]);
});
