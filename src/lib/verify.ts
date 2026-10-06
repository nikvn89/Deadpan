// Postconditions checked AFTER the receipt says SUCCESS, against reloaded
// accepted state. A write is reported as done only when the state shows it.

import { pyStrip } from "./pytext.ts";
import type { Balances, Jar, Reply } from "./types.ts";

const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();
const big = (v: string | undefined) => BigInt(v ?? "0");

export function openVerified(jar: Jar | null, s: { id: string; me: string; title: string; tipWei: bigint }): boolean {
  return !!jar && jar.jar_id === s.id && same(jar.creator, s.me) && jar.title === pyStrip(s.title) &&
    jar.tip_wei === s.tipWei.toString() && jar.state === "OPEN";
}

export type ReplyCheck = { ok: true; reply: Reply } | { ok: false };

/**
 * The new reply is the one at index before.comment_count, written by me with my text.
 * Its tip_moved is either the jar's tip (SINCERE_PRAISE) or 0 (NOT_PRAISE), and my
 * allowance dropped by exactly that amount. The jar's counters moved with it.
 */
export function replyVerified(
  before: { jar: Jar; balances: Balances },
  after: { jar: Jar | null; replies: Reply[]; balances: Balances | null },
  me: string,
  text: string,
): ReplyCheck {
  const { jar, replies, balances } = after;
  if (!jar || !balances) return { ok: false };
  const r = replies.find((x) => x.index === before.jar.comment_count);
  if (!r || !same(r.author, me) || r.text !== pyStrip(text)) return { ok: false };
  const sincere = r.outcome === "SINCERE_PRAISE";
  if (!sincere && r.outcome !== "NOT_PRAISE") return { ok: false };
  const moved = big(r.tip_moved);
  if (moved !== (sincere ? big(before.jar.tip_wei) : 0n)) return { ok: false };
  const ok =
    big(balances.allowance) === big(before.balances.allowance) - moved &&
    jar.comment_count === before.jar.comment_count + 1 &&
    jar.praised_count === before.jar.praised_count + (sincere ? 1 : 0) &&
    big(jar.tipped_total) === big(before.jar.tipped_total) + moved;
  return ok ? { ok: true, reply: r } : { ok: false };
}

export function closeVerified(jar: Jar | null): boolean {
  return !!jar && jar.state === "CLOSED";
}

export function fundVerified(before: Balances | null, after: Balances | null, value: bigint): boolean {
  return !!after && big(after.allowance) === big(before?.allowance) + value;
}

export function withdrawAllowanceVerified(before: Balances | null, after: Balances | null, amount: bigint): boolean {
  return !!before && !!after && big(after.allowance) === big(before.allowance) - amount;
}

export function withdrawEarningsVerified(before: Balances | null, after: Balances | null): boolean {
  return !!before && !!after && big(before.earnings) > 0n && big(after.earnings) === 0n;
}
