// Shapes of the contract's JSON views. Every amount is a decimal STRING in the
// view (wei exceeds 2^53) and stays a string until it is turned into a bigint.

export type Jar = {
  jar_id: string;
  creator: string;
  title: string;
  tip_wei: string;
  state: "OPEN" | "CLOSED" | string;
  comment_count: number;
  praised_count: number;
  tipped_total: string;
  reply_count: number;
};

export type Reply = {
  index: number;
  jar_id: string;
  author: string;
  text: string;
  outcome: "SINCERE_PRAISE" | "NOT_PRAISE" | string;
  tip_moved: string;
};

export type Balances = {
  wallet: string;
  allowance: string;
  earnings: string;
};

export type TxPhase = "idle" | "checking" | "signing" | "submitted" | "delayed" | "success" | "error";

export type TxStatus = {
  phase: TxPhase;
  message: string;
  hash?: string;
  action?: string;
};
