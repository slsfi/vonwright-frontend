export interface LoginRequest {
  email: string;
  password: string;
}

export type RegisterIntendedUsage = 'personal' | 'educational' | 'scholarly';

export interface RegisterRequest {
  name: string;
  email: string;
  password: string;
  language: string;
  country?: string;
  intended_usage?: string;
}

export interface ForgotPasswordRequest {
  email: string;
  language: string;
}

export interface ResetPasswordRequest {
  password: string;
}

export type BackendAuthErrorCode =
  | 'NO_CREDENTIALS'
  | 'EMAIL_NOT_VERIFIED'
  | 'INCORRECT_CREDENTIALS'
  | 'INVALID_CREDENTIALS'
  | 'PASSWORD_TOO_SHORT'
  | 'USER_ALREADY_EXISTS';

export interface BackendAuthErrorResponse {
  msg: string;
  err?: BackendAuthErrorCode;
}

export interface LoginResponse {
  access_token: string;
  msg: string;
  refresh_token: string;
  user_projects: string[];
}

export interface RegisterResponse {
  msg: string;
}

export interface ForgotPasswordResponse {
  msg: string;
}

export interface ResetPasswordResponse {
  msg: string;
}

export interface VerifyEmailResponse {
  msg: string;
}

export interface RefreshTokenResponse {
  msg: string;
  access_token: string;
}
