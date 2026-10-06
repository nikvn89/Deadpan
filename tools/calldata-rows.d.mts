export const ID: string;
export const TITLE: string;
export const MAX_TIP: bigint;
export const CASES: Record<string, string>;
export type Row = { name: string; method: string; args: unknown[] };
export function hardBlockRows(): Row[];
export function measureOnlyRows(): Row[];
