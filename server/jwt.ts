import jwt from "jsonwebtoken";

const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET;
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;

if (!ACCESS_SECRET || !REFRESH_SECRET) {
  throw new Error("JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must be set");
}

const ACCESS_TOKEN_TTL = "15m";
const REFRESH_TOKEN_TTL_SECONDS = 30 * 24 * 60 * 60; // 30 days

export interface AccessTokenPayload {
  sub: string; // userId
}

export interface RefreshTokenPayload {
  sub: string; // userId
  jti: string; // refresh_tokens.id, for revocation lookups
}

export function signAccessToken(userId: string): string {
  return jwt.sign({ sub: userId } satisfies AccessTokenPayload, ACCESS_SECRET!, {
    expiresIn: ACCESS_TOKEN_TTL,
  });
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  return jwt.verify(token, ACCESS_SECRET!) as AccessTokenPayload;
}

export function signRefreshToken(userId: string, jti: string): string {
  return jwt.sign({ sub: userId, jti } satisfies RefreshTokenPayload, REFRESH_SECRET!, {
    expiresIn: REFRESH_TOKEN_TTL_SECONDS,
  });
}

export function verifyRefreshToken(token: string): RefreshTokenPayload {
  return jwt.verify(token, REFRESH_SECRET!) as RefreshTokenPayload;
}

export function refreshTokenExpiryDate(): Date {
  return new Date(Date.now() + REFRESH_TOKEN_TTL_SECONDS * 1000);
}
