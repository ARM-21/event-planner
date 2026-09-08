export interface UserRow {
  id: number;
  name: string;
  email: string;
  password_hash: string;
  email_verified_at: Date | string | null;
  totp_secret: string | null;
  two_factor_enabled: boolean | number;
}

export interface RefreshTokenRow {
  id: number;
  user_id: number;
  token_hash: string;
  expires_at: Date | string;
  revoked_at: Date | string | null;
  replaced_by_id: number | null;
}

// still_valid is computed in SQL (expires_at compared against the DB's own
// clock via fn.now()) so this needs no separate expiry round-trip.
export interface RefreshTokenRowWithValidity extends RefreshTokenRow {
  still_valid: number;
}

export interface SessionMeta {
  deviceLabel: string | null;
  ip: string | null;
}

export type RotateResult =
  | { status: 'ok'; userId: number; rawToken: string }
  | { status: 'reused'; userId: number }
  | { status: 'invalid' };

export interface EmailVerificationRow {
  id: number;
  user_id: number;
  token_hash: string;
  expires_at: Date | string;
}
