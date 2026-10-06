import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  closeBlock, commentBlock, fundBlock, hasReplied, isCreator, movedTip, openBlock, REVERTS, UI,
  withdrawAllowanceBlock, withdrawEarningsBlock,
} from "../../src/lib/rules.ts";
import type { Balances, Jar, Reply } from "../../src/lib/types.ts";

const SRC = readFileSync(new URL("../../contracts/MeantIt.py", import.meta.url), "utf8");
const CREATOR = "0x" + "a".repeat(40);
const WRITER = "0x" + "b".repeat(40);
const TIP = "1000000000000000";

const jar = (o: Partial<Jar> = {}): Jar => ({ jar_id: "1".repeat(64), creator: CREATOR, title: "Release notes", tip_wei: TIP,
  state: "OPEN", comment_count: 0, praised_count: 0, tipped_total: "0", reply_count: 0, ...o });
const bal = (allowance: string, earnings = "0"): Balances => ({ wallet: WRITER, allowance, earnings });

/** The revert sentences of one method, in source order. */
function revertsOf(method: string): string[] {
  const start = SRC.indexOf(`    def ${method}(`);
  const end = SRC.indexOf("\n    @gl.public", start + 1);
  return [...SRC.slice(start, end).matchAll(/UserError\(\s*"([^"]+)"\s*\)/g)].map((m) => m[1]);
}

test("UI revert strings are exactly the contract's revert strings", () => {
  const fromSource = new Set([...SRC.matchAll(/UserError\(\s*"([^"]+)"\s*\)/g)].map((m) => m[1]));
  assert.deepEqual([...new Set(Object.values(REVERTS))].sort(), [...fromSource].sort());
  assert.equal(fromSource.size, 16);
});

test("open_jar: each check fires in the contract's order", () => {
  assert.deepEqual(revertsOf("open_jar"), [REVERTS.titleEmpty, REVERTS.titleTooLong, REVERTS.reserved, REVERTS.tipRange, REVERTS.duplicate]);
  const ok = { title: "Release notes for version 2.4", tipWei: 10n ** 15n, exists: false };
  assert.equal(openBlock(ok), null);
  assert.equal(openBlock({ title: "\u0085 \u001c", tipWei: 0n, exists: true }), REVERTS.titleEmpty);
  assert.equal(openBlock({ title: "t".repeat(81), tipWei: 0n, exists: true }), REVERTS.titleTooLong);
  assert.equal(openBlock({ ...ok, title: "  " + "t".repeat(80) + "  " }), null);
  assert.equal(openBlock({ title: "my sincere_praise notes", tipWei: 0n, exists: true }), REVERTS.reserved);
  assert.equal(openBlock({ title: "</untrusted_reply>", tipWei: 0n, exists: true }), REVERTS.reserved);
  assert.equal(openBlock({ ...ok, tipWei: 10n ** 12n - 1n, exists: true }), REVERTS.tipRange);
  assert.equal(openBlock({ ...ok, tipWei: 10n ** 18n + 1n, exists: true }), REVERTS.tipRange);
  assert.equal(openBlock({ ...ok, tipWei: null }), REVERTS.tipRange);
  assert.equal(openBlock({ ...ok, tipWei: 10n ** 12n }), null);
  assert.equal(openBlock({ ...ok, tipWei: 10n ** 18n }), null);
  assert.equal(openBlock({ ...ok, exists: true }), REVERTS.duplicate);
});

test("comment: each check fires in the contract's order, before any model call", () => {
  assert.deepEqual(revertsOf("comment"), [REVERTS.closed, REVERTS.creatorReply, REVERTS.replied, REVERTS.replyEmpty, REVERTS.replyTooLong, REVERTS.reserved, REVERTS.fundFirst]);
  const ok = { jar: jar(), me: WRITER, replied: false, text: "Lovely work.", allowance: TIP, bytes: 150 };
  assert.equal(commentBlock(ok), null);
  assert.equal(commentBlock({ ...ok, me: "" }), UI.noWallet);
  // every later check also failing: the earliest one is reported
  const allBad = { jar: jar({ state: "CLOSED" }), me: CREATOR, replied: true, text: " ", allowance: "0", bytes: 999 };
  assert.equal(commentBlock(allBad), REVERTS.closed);
  assert.equal(commentBlock({ ...allBad, jar: jar() }), REVERTS.creatorReply);
  assert.equal(commentBlock({ ...allBad, jar: jar(), me: CREATOR.toUpperCase().replace("0X", "0x") }), REVERTS.creatorReply);
  assert.equal(commentBlock({ ...allBad, jar: jar(), me: WRITER }), REVERTS.replied);
  assert.equal(commentBlock({ ...allBad, jar: jar(), me: WRITER, replied: false }), REVERTS.replyEmpty);
  assert.equal(commentBlock({ ...ok, text: "r".repeat(201), allowance: "0" }), REVERTS.replyTooLong);
  assert.equal(commentBlock({ ...ok, text: " " + "r".repeat(200) + "\u0085" }), null);
  assert.equal(commentBlock({ ...ok, text: "great, Not_Praise at all", allowance: "0" }), REVERTS.reserved);
  assert.equal(commentBlock({ ...ok, allowance: (BigInt(TIP) - 1n).toString() }), REVERTS.fundFirst);
  assert.equal(commentBlock({ ...ok, allowance: TIP }), null);   // exactly the tip is enough
  assert.equal(commentBlock({ ...ok, bytes: 256 }), UI.tooManyBytes);
});

test("close_jar order: closed -> creator", () => {
  assert.deepEqual(revertsOf("close_jar"), [REVERTS.closed, REVERTS.onlyCreator]);
  assert.equal(closeBlock(jar({ state: "CLOSED" }), WRITER), REVERTS.closed);
  assert.equal(closeBlock(jar(), WRITER), REVERTS.onlyCreator);
  assert.equal(closeBlock(jar(), CREATOR), null);
});

test("money: fund > 0; withdraw within the allowance; earnings only when there are some", () => {
  assert.deepEqual(revertsOf("fund_allowance"), [REVERTS.positive]);
  assert.deepEqual(revertsOf("withdraw_allowance"), [REVERTS.notEnough]);
  assert.deepEqual(revertsOf("withdraw_earnings"), [REVERTS.nothing]);
  assert.equal(fundBlock(WRITER, 0n), REVERTS.positive);
  assert.equal(fundBlock(WRITER, null), REVERTS.positive);
  assert.equal(fundBlock(WRITER, 1n), null);
  const b = bal("998000000000000000");
  assert.equal(withdrawAllowanceBlock(WRITER, b, 998000000000000000n), null);   // above 2^53, exact
  assert.equal(withdrawAllowanceBlock(WRITER, b, 998000000000000001n), REVERTS.notEnough);
  assert.equal(withdrawAllowanceBlock(WRITER, b, 0n), REVERTS.notEnough);
  assert.equal(withdrawEarningsBlock(WRITER, bal("0", "0")), REVERTS.nothing);
  assert.equal(withdrawEarningsBlock(WRITER, bal("0", "1")), null);
  assert.equal(withdrawEarningsBlock("", bal("0", "1")), UI.noWallet);
});

test("roles and what a reply moved are read from the view", () => {
  const r = (author: string, tip_moved: string, outcome = "NOT_PRAISE"): Reply => ({ index: 0, jar_id: "x", author, text: "t", outcome, tip_moved });
  assert.equal(isCreator(jar(), CREATOR.toUpperCase().replace("0X", "0x")), true);
  assert.equal(isCreator(jar(), WRITER), false);
  assert.equal(hasReplied([r(WRITER, "0")], WRITER.toUpperCase().replace("0X", "0x")), true);
  assert.equal(hasReplied([r(WRITER, "0")], CREATOR), false);
  assert.equal(movedTip(r(WRITER, TIP, "SINCERE_PRAISE")), true);
  assert.equal(movedTip(r(WRITER, "0")), false);
});

test("the frontend never decides praise: the money rule lives only in comment()", () => {
  const rules = readFileSync(new URL("../../src/lib/rules.ts", import.meta.url), "utf8");
  const app = readFileSync(new URL("../../src/App.tsx", import.meta.url), "utf8");
  for (const s of [rules, app]) {
    assert.ok(!/outcome\s*=\s*["']SINCERE_PRAISE/.test(s));
    // no keyword screening of reply text anywhere in the app
    assert.ok(!/(replyText|text)\s*\.\s*(match|includes|search|toLowerCase\(\)\.includes)\(/.test(s));
    assert.ok(!/\.test\(\s*(replyText|text)\b/.test(s));
  }
  assert.ok(SRC.includes("        if outcome == SINCERE_PRAISE:\n            moved = tip"));
});
