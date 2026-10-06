import { keccak256, stringToBytes } from "viem";
import { pyLen, pyNormalize, pyStrip } from "./pytext.ts";

// Keccak-256 (Ethereum), not NIST SHA3-256. Same payload as the contract:
// keccak256("MEANT_IT:JAR:V1|" + creator_lower + "|" + len(title) + "|" + title),
// with the title stripped and its whitespace collapsed exactly like Python.
export function jarId(creatorWallet: string, title: string): string {
  const normalized = pyNormalize(pyStrip(title));
  const payload = "MEANT_IT:JAR:V1|" + creatorWallet.toLowerCase() + "|" + String(pyLen(normalized)) + "|" + normalized;
  return keccak256(stringToBytes(payload)).slice(2);
}

/** Accepts a bare id, a 0x id, or a link carrying ?jar=<id>. Returns "" when none is found. */
export function jarIdFromInput(value: string): string {
  const m = value.match(/(?<![0-9a-fA-F])([0-9a-fA-F]{64})(?![0-9a-fA-F])/);
  return m ? m[1].toLowerCase() : "";
}

export function short(value: string, head = 6, tail = 4): string {
  if (!value || value.length <= head + tail + 1) return value;
  return `${value.slice(0, head)}…${value.slice(-tail)}`;
}
