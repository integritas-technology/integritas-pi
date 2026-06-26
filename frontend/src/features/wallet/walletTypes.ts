export type TokenBalance = {
  tokenId: string;
  name: string;
  confirmed: string;
  unconfirmed: string;
  sendable: string;
  isNative: boolean;
};

export type WalletStatus = {
  checkedAt: string;
  tokens: TokenBalance[];
};

export type ReceiveAddress = {
  miniAddress: string;  // Mx… — Minima native format; use this for display/sharing
  address: string;      // 0x… — hex format
  publicKey?: string;
};

export type SendPaymentRequest = {
  address: string;
  amount: string;
  tokenId?: string;
  tokenName?: string;
};

export type SendPaymentResult = {
  ok: boolean;
  txpowId: string | null;
  status: "pending" | "sent" | "failed";
  message?: string;
};

export type PaymentStatus = {
  txpowId: string;
  status: "pending" | "confirmed" | "failed" | "unknown";
  checkedAt: string;
};

export type ImportWalletResult = {
  ok: boolean;
  message: string;
};

export type WalletSendHistoryItem = {
  id: string;
  createdAt: string;
  toAddress: string;
  tokenId: string;
  tokenName: string;
  amount: string;
  txpowId: string | null;
  status: "submitted" | "failed";
};
