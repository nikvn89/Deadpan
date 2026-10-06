// Contract views return JSON strings. MeantIt already writes every amount as a
// decimal string, so nothing is ever read as a JS number except small counters.
import type { Balances, Jar, Reply } from "./types.ts";

function parseObject(raw: string): Record<string, unknown> | null {
  try {
    let value: unknown = JSON.parse(raw);
    if (typeof value === "string") value = JSON.parse(value);
    if (!value || typeof value !== "object" || Array.isArray(value) || Object.keys(value).length === 0) return null;
    return value as Record<string, unknown>;
  } catch {
    return null;
  }
}

const isAmount = (v: unknown) => typeof v === "string" && /^\d+$/.test(v);

export function parseJar(raw: string): Jar | null {
  const o = parseObject(raw);
  if (!o || typeof o.jar_id !== "string" || !isAmount(o.tip_wei) || !isAmount(o.tipped_total)) return null;
  return o as unknown as Jar;
}

export type ReplyPage = { total: number; replies: Reply[] };

export function parseReplies(raw: string): ReplyPage {
  const o = parseObject(raw);
  if (!o || !Array.isArray(o.replies)) return { total: 0, replies: [] };
  const replies = (o.replies as Reply[]).filter((r) => r && typeof r.text === "string" && isAmount(r.tip_moved));
  return { total: Number(o.total ?? replies.length), replies };
}

export function parseBalances(raw: string): Balances | null {
  const o = parseObject(raw);
  if (!o || !isAmount(o.allowance) || !isAmount(o.earnings)) return null;
  return o as unknown as Balances;
}
