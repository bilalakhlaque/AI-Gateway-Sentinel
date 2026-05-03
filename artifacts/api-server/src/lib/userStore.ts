import { scryptSync, randomBytes, timingSafeEqual } from "crypto";
import { randomUUID } from "crypto";

export interface User {
  userId: string;
  username: string;
  passwordHash: string;
  createdAt: string;
}

const users = new Map<string, User>();

function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  try {
    const derived = scryptSync(password, salt, 64);
    return timingSafeEqual(derived, Buffer.from(hash, "hex"));
  } catch {
    return false;
  }
}

export function createUser(username: string, password: string): User | null {
  const existing = [...users.values()].find(
    (u) => u.username.toLowerCase() === username.toLowerCase(),
  );
  if (existing) return null;

  const user: User = {
    userId: randomUUID(),
    username,
    passwordHash: hashPassword(password),
    createdAt: new Date().toISOString(),
  };
  users.set(user.userId, user);
  return user;
}

export function authenticateUser(username: string, password: string): User | null {
  const user = [...users.values()].find(
    (u) => u.username.toLowerCase() === username.toLowerCase(),
  );
  if (!user) return null;
  if (!verifyPassword(password, user.passwordHash)) return null;
  return user;
}

export function getUserById(userId: string): User | null {
  return users.get(userId) ?? null;
}

export function getAllUsers(): Array<{ userId: string; username: string; createdAt: string }> {
  return [...users.values()].map(({ userId, username, createdAt }) => ({
    userId,
    username,
    createdAt,
  }));
}
