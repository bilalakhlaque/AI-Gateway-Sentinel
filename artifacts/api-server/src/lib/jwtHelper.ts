import { SignJWT, jwtVerify } from "jose";

const raw = process.env["SESSION_SECRET"] ?? "sentinai-dev-secret-change-me";
const secret = new TextEncoder().encode(raw);

export interface JwtPayload {
  userId: string;
  username: string;
}

export async function signToken(payload: JwtPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(secret);
}

export async function verifyToken(token: string): Promise<JwtPayload> {
  const { payload } = await jwtVerify(token, secret);
  if (
    typeof payload["userId"] !== "string" ||
    typeof payload["username"] !== "string"
  ) {
    throw new Error("Invalid token payload");
  }
  return { userId: payload["userId"], username: payload["username"] };
}
