import { test } from "node:test";
import assert from "node:assert/strict";
import {
  closeVerified, fundVerified, openVerified, replyVerified, withdrawAllowanceVerified, withdrawEarningsVerified,
} from "../../src/lib/verify.ts";
import type { Balances, Jar, Reply } from "../../src/lib/types.ts";

const ME = "0x" + "b".repeat(40);
const TIP = "1000000000000000";
const jar = (o: Partial<Jar> = {}): Jar => ({ jar_id: "j".repeat(64), creator: "0x" + "a".repeat(40), title: "Release notes",
  tip_wei: TIP, state: "OPEN", comment_count: 1, praised_count: 0, tipped_total: "0", reply_count: 1, ...o });
const bal = (allowance: string, earnings = "0"): Balances => ({ wallet: ME, allowance, earnings });
const reply = (o: Partial<Reply> = {}): Reply => ({ index: 1, jar_id: "j".repeat(64), author: ME, text: "Lovely work.", outcome: "SINCERE_PRAISE", tip_moved: TIP, ...o });
const before = { jar: jar(), balances: bal("999000000000000000") };

test("open: the stored jar must carry my wallet, the stripped title and the tip", () => {
  const s = { id: "j".repeat(64), me: "0x" + "A".repeat(40), title: "  Release notes ", tipWei: 10n ** 15n };
  assert.equal(openVerified(jar(), s), true);
  assert.equal(openVerified(jar({ tip_wei: "1" }), s), false);
  assert.equal(openVerified(jar({ creator: ME }), s), false);
  assert.equal(openVerified(null, s), false);
});

test("SINCERE_PRAISE: the tip left my allowance and the jar counted it", () => {
  const ok = replyVerified(before, { jar: jar({ comment_count: 2, praised_count: 1, tipped_total: TIP }), replies: [reply()], balances: bal("998000000000000000") }, ME, " Lovely work. ");
  assert.equal(ok.ok, true);
  // allowance did not move although the reply says it paid
  assert.equal(replyVerified(before, { jar: jar({ comment_count: 2, praised_count: 1, tipped_total: TIP }), replies: [reply()], balances: bal("999000000000000000") }, ME, "Lovely work.").ok, false);
});

test("NOT_PRAISE: nothing moved, and the allowance is unchanged", () => {
  const r = reply({ outcome: "NOT_PRAISE", tip_moved: "0" });
  assert.equal(replyVerified(before, { jar: jar({ comment_count: 2 }), replies: [r], balances: bal("999000000000000000") }, ME, "Lovely work.").ok, true);
  assert.equal(replyVerified(before, { jar: jar({ comment_count: 2 }), replies: [r], balances: bal("998000000000000000") }, ME, "Lovely work.").ok, false);
  // a NOT_PRAISE reply that claims a tip moved is rejected
  assert.equal(replyVerified(before, { jar: jar({ comment_count: 2 }), replies: [reply({ outcome: "NOT_PRAISE" })], balances: bal("998000000000000000") }, ME, "Lovely work.").ok, false);
});

test("the reply must be mine, at the next index, with my text", () => {
  const after = { jar: jar({ comment_count: 2, praised_count: 1, tipped_total: TIP }), balances: bal("998000000000000000") };
  assert.equal(replyVerified(before, { ...after, replies: [reply({ author: "0x" + "c".repeat(40) })] }, ME, "Lovely work.").ok, false);
  assert.equal(replyVerified(before, { ...after, replies: [reply({ index: 0 })] }, ME, "Lovely work.").ok, false);
  assert.equal(replyVerified(before, { ...after, replies: [reply()] }, ME, "Other text").ok, false);
  assert.equal(replyVerified(before, { ...after, replies: [reply({ outcome: "MAYBE" })] }, ME, "Lovely work.").ok, false);
});

test("close, fund and withdrawals are checked on the reloaded balances", () => {
  assert.equal(closeVerified(jar({ state: "CLOSED" })), true);
  assert.equal(closeVerified(jar()), false);
  assert.equal(fundVerified(bal("0"), bal("1000000000000000000"), 10n ** 18n), true);
  assert.equal(fundVerified(null, bal("5"), 5n), true);
  assert.equal(fundVerified(bal("1"), bal("1"), 5n), false);
  assert.equal(withdrawAllowanceVerified(bal("998000000000000000"), bal("990000000000000000"), 8000000000000000n), true);
  assert.equal(withdrawAllowanceVerified(bal("998000000000000000"), bal("998000000000000000"), 8000000000000000n), false);
  assert.equal(withdrawEarningsVerified(bal("0", "3000000000000000"), bal("0", "0")), true);
  assert.equal(withdrawEarningsVerified(bal("0", "0"), bal("0", "0")), false);
});
