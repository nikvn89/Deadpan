// Mirrors every revert of contracts/MeantIt.py that can be predicted from state
// already read, in the SAME order the contract checks them. Whether a reply is
// praise is NEVER decided here: only validators decide that, inside comment().
// What a reply moved is read back from the view (outcome, tip_moved).

import { pyContainsToken, pyLen, pyStrip } from "./pytext.ts";
import type { Balances, Jar, Reply } from "./types.ts";

export const MAX_TITLE_LENGTH = 80;
export const MAX_COMMENT_LENGTH = 200;
export const MIN_TIP_WEI = 10n ** 12n;
export const MAX_TIP_WEI = 10n ** 18n;
export const MAX_PAGE_SIZE = 50;

export const RESERVED_TOKENS = [
  "<UNTRUSTED_RELEASE_TITLE>",
  "</UNTRUSTED_RELEASE_TITLE>",
  "<UNTRUSTED_REPLY>",
  "</UNTRUSTED_REPLY>",
  "SINCERE_PRAISE",
  "NOT_PRAISE",
] as const;

export const REVERTS = {
  unknownJar: "Unknown jar id",
  titleEmpty: "Title is empty",
  titleTooLong: "Title is too long",
  reserved: "Text contains a reserved token",
  tipRange: "The tip is out of range",
  duplicate: "This jar already exists",
  positive: "Send a positive amount",
  closed: "This jar is closed",
  creatorReply: "The creator cannot reply to their own jar",
  replied: "You have already replied to this jar",
  replyEmpty: "Reply is empty",
  replyTooLong: "Reply is too long",
  fundFirst: "Fund your allowance before replying",
  onlyCreator: "Only the creator may close this jar",
  notEnough: "Not enough allowance",
  nothing: "Nothing to withdraw",
} as const;

/** UI-only reasons (the contract never sees these calls). */
export const UI = {
  noWallet: "Connect a wallet first",
  tooManyBytes: "This reply is over the 255-byte calldata limit; shorten it",
} as const;

const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

export function isCreator(jar: Jar, me: string): boolean {
  return !!me && same(jar.creator, me);
}

export function hasReplied(replies: Reply[], me: string): boolean {
  return !!me && replies.some((r) => same(r.author, me));
}

export type OpenInput = { title: string; tipWei: bigint | null; exists: boolean };

/** open_jar order: title empty -> too long -> reserved -> tip range -> duplicate. */
export function openBlock(i: OpenInput): string | null {
  const t = pyStrip(i.title);
  if (pyLen(t) === 0) return REVERTS.titleEmpty;
  if (pyLen(t) > MAX_TITLE_LENGTH) return REVERTS.titleTooLong;
  if (pyContainsToken(t, RESERVED_TOKENS)) return REVERTS.reserved;
  if (i.tipWei === null || i.tipWei < MIN_TIP_WEI || i.tipWei > MAX_TIP_WEI) return REVERTS.tipRange;
  if (i.exists) return REVERTS.duplicate;
  return null;
}

export type CommentInput = { jar: Jar; me: string; replied: boolean; text: string; allowance: string; bytes: number };

/** comment order: OPEN -> not the creator -> first reply -> text -> reserved -> allowance >= tip. */
export function commentBlock(i: CommentInput): string | null {
  if (!i.me) return UI.noWallet;
  if (i.jar.state !== "OPEN") return REVERTS.closed;
  if (isCreator(i.jar, i.me)) return REVERTS.creatorReply;
  if (i.replied) return REVERTS.replied;
  const t = pyStrip(i.text);
  if (pyLen(t) === 0) return REVERTS.replyEmpty;
  if (pyLen(t) > MAX_COMMENT_LENGTH) return REVERTS.replyTooLong;
  if (pyContainsToken(t, RESERVED_TOKENS)) return REVERTS.reserved;
  if (BigInt(i.allowance || "0") < BigInt(i.jar.tip_wei)) return REVERTS.fundFirst;
  if (i.bytes > 255) return UI.tooManyBytes;
  return null;
}

/** close_jar order: OPEN -> creator. */
export function closeBlock(jar: Jar, me: string): string | null {
  if (!me) return UI.noWallet;
  if (jar.state !== "OPEN") return REVERTS.closed;
  if (!isCreator(jar, me)) return REVERTS.onlyCreator;
  return null;
}

export function fundBlock(me: string, value: bigint | null): string | null {
  if (!me) return UI.noWallet;
  if (value === null || value <= 0n) return REVERTS.positive;
  return null;
}

export function withdrawAllowanceBlock(me: string, b: Balances | null, amount: bigint | null): string | null {
  if (!me) return UI.noWallet;
  if (amount === null || amount <= 0n || amount > BigInt(b?.allowance ?? "0")) return REVERTS.notEnough;
  return null;
}

export function withdrawEarningsBlock(me: string, b: Balances | null): string | null {
  if (!me) return UI.noWallet;
  if (BigInt(b?.earnings ?? "0") <= 0n) return REVERTS.nothing;
  return null;
}

/** What a stored reply did, straight from the view's own fields. */
export function movedTip(r: Reply): boolean {
  return BigInt(r.tip_moved) > 0n;
}
