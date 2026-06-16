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

export type WalletAccountTokenBalance = {
  tokenId: string;
  name: string;
  amount: string;
  isNative: boolean;
};

export type WalletAccountBalance = {
  accountId: string;
  totalMinima: string;
  tokenCount: number;
  tokens: WalletAccountTokenBalance[];
};

export type WalletAccount = {
  id: string;
  label: string;
  address: string;
  miniAddress: string;
  publicKey?: string;
  createdAt: string;
  updatedAt: string;
  balance: WalletAccountBalance;
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
  fromAccountAddress?: string;
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
