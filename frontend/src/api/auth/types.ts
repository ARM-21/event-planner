export interface User {
  id: number;
  name: string;
  email: string;
  emailVerified: boolean;
}

export interface AuthResponse {
  user: User;
  token: string;
}
