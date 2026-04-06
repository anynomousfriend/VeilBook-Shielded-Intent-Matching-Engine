export type TraderState =
  | "IDLE"
  | "FORM_OPEN"
  | "PROVING"
  | "ORDER_COMMITTED"
  | "MATCHING"
  | "MATCHED"
  | "MATCH_FAILED";

export interface OrderData {
  direction: "BUY" | "SELL";
  price: number;
  size: number;
  commitment?: string;
  blockHeight?: number;
  nonce?: string;
}
