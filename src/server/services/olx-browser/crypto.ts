import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";

const ENCRYPTION_VERSION = 1;
const KEY_CONTEXT = "persona:olx-browser-session:v1";

type EncryptedPayload = {
  v: typeof ENCRYPTION_VERSION;
  iv: string;
  tag: string;
  data: string;
};

function deriveKey(secret: string): Buffer {
  return createHash("sha256")
    .update(KEY_CONTEXT)
    .update("\0")
    .update(secret)
    .digest();
}

/** Encrypts Playwright storage state with authenticated AES-256-GCM. */
export function encryptOlxStorageState(value: unknown, secret: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", deriveKey(secret), iv);
  const plaintext = Buffer.from(JSON.stringify(value), "utf8");
  const data = Buffer.concat([cipher.update(plaintext), cipher.final()]);

  const payload: EncryptedPayload = {
    v: ENCRYPTION_VERSION,
    iv: iv.toString("base64url"),
    tag: cipher.getAuthTag().toString("base64url"),
    data: data.toString("base64url"),
  };

  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}

/** Decrypts and authenticates a saved Playwright storage state. */
export function decryptOlxStorageState<T>(
  encrypted: string,
  secret: string,
): T {
  const payload = JSON.parse(
    Buffer.from(encrypted, "base64url").toString("utf8"),
  ) as Partial<EncryptedPayload>;

  if (
    payload.v !== ENCRYPTION_VERSION ||
    !payload.iv ||
    !payload.tag ||
    !payload.data
  ) {
    throw new Error("Unsupported OLX browser session format");
  }

  const decipher = createDecipheriv(
    "aes-256-gcm",
    deriveKey(secret),
    Buffer.from(payload.iv, "base64url"),
  );
  decipher.setAuthTag(Buffer.from(payload.tag, "base64url"));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(payload.data, "base64url")),
    decipher.final(),
  ]);

  return JSON.parse(plaintext.toString("utf8")) as T;
}
