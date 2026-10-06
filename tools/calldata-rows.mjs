// Shared rows for tools/calldata-bytes.mjs, tools/probe-calldata.mjs and tests.
export const ID = "f".repeat(64);
export const TITLE = "Release notes for version 2.4 of a photo app";
export const MAX_TIP = 10n ** 18n;

export const CASES = {
  S1: "This update finally keeps my settings after a restart. Thank you.",
  S2: "Took me ten seconds to find the new export button. Lovely work.",
  S3: "Great, another update, and this one made the app open twice as fast.",
  S4: "I expected the worst from a big redesign, and it is the best version yet.",
  S5: "Not what I asked for, but the new layout is better than my idea, I admit.",
  N1: "Great, another update that wipes my settings after every restart. Thank you.",
  N2: "Took me ten minutes to find the new export button. Lovely work.",
  N3: "Wow, the app now opens twice as slow. Truly a masterpiece.",
  N4: "I expected the worst from a big redesign, and you somehow beat that.",
  N5: "Love how the new layout hides everything I use daily.",
};

/** HARD BLOCK: any of these over 255 bytes stops the release. */
export function hardBlockRows() {
  const rows = Object.entries(CASES).map(([name, text]) => ({ name: `comment ${name}`, method: "comment", args: [ID, text] }));
  rows.push({ name: "comment (N6, added on-chain)", method: "comment", args: [ID, "I expected the worst from a big redesign, and it delivered exactly that."] });
  rows.push({ name: "open_jar (80-char title + 10^18 tip)", method: "open_jar", args: ["t".repeat(80), MAX_TIP] });
  rows.push({ name: "open_jar (table title + 10^15 tip)", method: "open_jar", args: [TITLE, 10n ** 15n] });
  rows.push({ name: "fund_allowance ()", method: "fund_allowance", args: [] });
  rows.push({ name: "close_jar (id)", method: "close_jar", args: [ID] });
  rows.push({ name: "withdraw_allowance (10^18)", method: "withdraw_allowance", args: [MAX_TIP] });
  rows.push({ name: "withdraw_earnings ()", method: "withdraw_earnings", args: [] });
  return rows;
}

/** MEASURE ONLY: the contract accepts 200 characters; the RPC does not carry that much. */
export function measureOnlyRows() {
  return [{ name: "comment at the 200-character cap", method: "comment", args: [ID, "x".repeat(200)] }];
}
