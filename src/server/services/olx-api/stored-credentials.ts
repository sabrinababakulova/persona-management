import { env } from "~/env";
import {
  decryptOlxCredentials,
  encryptOlxCredentials,
  type OlxEncryptionKey,
  olxEncryptionKeyId,
} from "./crypto";

function configuredKeys(): OlxEncryptionKey[] {
  const activeSecret = env.OLX_CREDENTIALS_ENCRYPTION_KEY;
  if (!activeSecret) {
    if (env.NODE_ENV === "test") {
      return [{ id: "test", secret: env.AUTH_SECRET }];
    }
    throw new Error("OLX_CREDENTIALS_ENCRYPTION_KEY is required");
  }

  return [
    activeSecret,
    ...(env.OLX_CREDENTIALS_PREVIOUS_ENCRYPTION_KEYS?.split(",") ?? []),
  ]
    .map((secret) => secret.trim())
    .filter(Boolean)
    .map((secret) => ({ id: olxEncryptionKeyId(secret), secret }));
}

function credentialAad(userId: string, sessionId: string): string {
  return `user:${userId}\0olx-session:${sessionId}`;
}

export function encryptStoredOlxCredentials(
  value: unknown,
  userId: string,
  sessionId: string,
): string {
  const [activeKey] = configuredKeys();
  if (!activeKey)
    throw new Error("No OLX credential encryption key configured");
  return encryptOlxCredentials(
    value,
    activeKey,
    credentialAad(userId, sessionId),
  );
}

export function decryptStoredOlxCredentials<T>(
  encrypted: string,
  userId: string,
  sessionId: string,
): T {
  return decryptOlxCredentials<T>(
    encrypted,
    configuredKeys(),
    credentialAad(userId, sessionId),
    env.AUTH_SECRET,
  );
}
