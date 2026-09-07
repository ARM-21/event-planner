export interface User {
  id: number;
  name: string;
  email: string;
  emailVerified: boolean;
  twoFactorEnabled: boolean;
}

export interface AuthResponse {
  user: User;
  token: string;
}

// What `login` returns when the account has 2FA enabled — no tokens yet,
// just a short-lived pre-auth token to trade (with a code) at `/2fa/verify`.
export interface TwoFactorRequiredResponse {
  twoFactorRequired: true;
  preAuthToken: string;
}

export type LoginResult = AuthResponse | TwoFactorRequiredResponse;

export function isTwoFactorRequired(result: LoginResult): result is TwoFactorRequiredResponse {
  return 'twoFactorRequired' in result;
}
