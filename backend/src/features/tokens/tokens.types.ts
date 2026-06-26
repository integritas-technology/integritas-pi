export type TokenCreateRequirements = {
  estimatedMinimaCost: string;
  minimumAccountMinima: string;
  note: string;
};

export type CreateTokenRequest = {
  name: string;
  amount: string;
  decimal: number;
};

export type CreateTokenResult = {
  ok: boolean;
  tokenId: string | null;
  name: string;
  amount: string;
  decimal: number;
  txpowId: string | null;
  message?: string;
};

export type TokenListItem = {
  tokenId: string;
  name: string;
  confirmed: string;
  unconfirmed: string;
  sendable: string;
  isNative: false;
  createdLocally: boolean;
  decimal?: number;
};

export type TokenListResponse = {
  checkedAt: string;
  tokens: TokenListItem[];
};

export type CustomTokenRecord = {
  id: string;
  token_id: string;
  name: string;
  amount: string;
  decimal: number;
  txpow_id: string | null;
  created_at: string;
};
