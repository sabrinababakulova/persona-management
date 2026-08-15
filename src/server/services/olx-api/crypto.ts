import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";

const LEGACY_ENCRYPTION_VERSION = 1;
const ENCRYPTION_VERSION = 2;
const KEY_CONTEXT = "persona:olx-api-credentials:v2";

type LegacyEncryptedPayload = {
  v: typeof LEGACY_ENCRYPTION_VERSION;
  iv: string;
  tag: string;
  data: string;
};

type EncryptedPayload = {
  v: typeof ENCRYPTION_VERSION;
  kid: string;
  iv: string;
  tag: string;
  data: string;
};

export type OlxEncryptionKey = {
  id: string;
  secret: string;
};

function deriveKey(secret: string, context = KEY_CONTEXT): Buffer {
  return createHash("sha256")
    .update(context)
    .update("\0")
    .update(secret)
    .digest();
}

export function olxEncryptionKeyId(secret: string): string {
  return createHash("sha256").update(secret).digest("base64url").slice(0, 16);
}

/** Encrypts the OLX token set with authenticated AES-256-GCM encryption. */
export function encryptOlxCredentials(
  value: unknown,
  key: OlxEncryptionKey,
  aad: string,
): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", deriveKey(key.secret), iv);
  cipher.setAAD(Buffer.from(aad, "utf8"));
  const plaintext = Buffer.from(JSON.stringify(value), "utf8");
  const data = Buffer.concat([cipher.update(plaintext), cipher.final()]);

  const payload: EncryptedPayload = {
    v: ENCRYPTION_VERSION,
    kid: key.id,
    iv: iv.toString("base64url"),
    tag: cipher.getAuthTag().toString("base64url"),
    data: data.toString("base64url"),
  };

  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}

/** Decrypts and authenticates a saved OLX API token set. */
export function decryptOlxCredentials<T>(
  encrypted: string,
  keys: readonly OlxEncryptionKey[],
  aad: string,
  legacySecret?: string,
): T {
  const payload = JSON.parse(
    Buffer.from(encrypted, "base64url").toString("utf8"),
  ) as Partial<EncryptedPayload | LegacyEncryptedPayload>;

  if (payload.v === LEGACY_ENCRYPTION_VERSION) {
    if (!legacySecret || !payload.iv || !payload.tag || !payload.data) {
      throw new Error("Unsupported OLX API credential format");
    }
    const decipher = createDecipheriv(
      "aes-256-gcm",
      deriveKey(legacySecret, "persona:olx-api-credentials:v1"),
      Buffer.from(payload.iv, "base64url"),
    );
    decipher.setAuthTag(Buffer.from(payload.tag, "base64url"));
    const plaintext = Buffer.concat([
      decipher.update(Buffer.from(payload.data, "base64url")),
      decipher.final(),
    ]);
    return JSON.parse(plaintext.toString("utf8")) as T;
  }

  if (
    payload.v !== ENCRYPTION_VERSION ||
    !("kid" in payload) ||
    !payload.kid ||
    !payload.iv ||
    !payload.tag ||
    !payload.data
  ) {
    throw new Error("Unsupported OLX API credential format");
  }

  const key = keys.find((candidate) => candidate.id === payload.kid);
  if (!key) throw new Error("Unknown OLX API credential key");

  const decipher = createDecipheriv(
    "aes-256-gcm",
    deriveKey(key.secret),
    Buffer.from(payload.iv, "base64url"),
  );
  decipher.setAAD(Buffer.from(aad, "utf8"));
  decipher.setAuthTag(Buffer.from(payload.tag, "base64url"));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(payload.data, "base64url")),
    decipher.final(),
  ]);

  return JSON.parse(plaintext.toString("utf8")) as T;
}
