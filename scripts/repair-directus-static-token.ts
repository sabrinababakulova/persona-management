import { randomBytes } from "node:crypto";
import { chmod, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

type DirectusLoginResponse = {
  data?: {
    access_token?: string;
  };
  errors?: { message?: string }[];
};

type DirectusUserResponse = {
  data?: {
    id?: string;
  };
  errors?: { message?: string }[];
};

function requireEnvironmentValue(name: string) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is required to repair the Directus static token`);
  }
  return value;
}

function describeDirectusErrors(payload: { errors?: { message?: string }[] }) {
  return (
    payload.errors
      ?.map((error) => error.message)
      .filter(Boolean)
      .join("; ") || "unknown Directus error"
  );
}

async function readJson<T>(response: Response): Promise<T> {
  try {
    return (await response.json()) as T;
  } catch {
    throw new Error(
      `Directus returned a non-JSON response (${response.status})`,
    );
  }
}

async function updateEnvFile(filePath: string, token: string) {
  const original = await readFile(filePath, "utf8");
  const line = `DIRECTUS_TOKEN=${JSON.stringify(token)}`;
  const matcher = /^\s*DIRECTUS_TOKEN\s*=.*$/m;
  const updated = matcher.test(original)
    ? original.replace(matcher, line)
    : `${original.replace(/\s*$/, "")}\n${line}\n`;
  const temporaryPath = `${filePath}.${process.pid}.tmp`;

  await writeFile(temporaryPath, updated, {
    encoding: "utf8",
    mode: 0o600,
    flag: "wx",
  });
  await rename(temporaryPath, filePath);
  await chmod(filePath, 0o600);
}

async function main() {
  const directusUrl = (
    process.env.DIRECTUS_INTERNAL_URL ?? requireEnvironmentValue("DIRECTUS_URL")
  ).replace(/\/$/, "");
  const adminEmail = requireEnvironmentValue("DIRECTUS_ADMIN_EMAIL");
  const adminPassword = requireEnvironmentValue("DIRECTUS_ADMIN_PASSWORD");
  const envFile = path.resolve(process.argv[2] ?? ".env");

  const loginResponse = await fetch(`${directusUrl}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: adminEmail,
      password: adminPassword,
      mode: "json",
    }),
  });
  const login = await readJson<DirectusLoginResponse>(loginResponse);
  const accessToken = login.data?.access_token;
  if (!loginResponse.ok || !accessToken) {
    throw new Error(
      `Directus admin login failed (${loginResponse.status}): ${describeDirectusErrors(login)}`,
    );
  }

  const meResponse = await fetch(`${directusUrl}/users/me?fields=id`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const me = await readJson<DirectusUserResponse>(meResponse);
  const userId = me.data?.id;
  if (!meResponse.ok || !userId) {
    throw new Error(
      `Unable to resolve the Directus admin user (${meResponse.status}): ${describeDirectusErrors(me)}`,
    );
  }

  const staticToken = randomBytes(32).toString("hex");
  const patchResponse = await fetch(`${directusUrl}/users/${userId}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ token: staticToken }),
  });
  if (!patchResponse.ok) {
    const payload = await readJson<DirectusUserResponse>(patchResponse);
    throw new Error(
      `Unable to set the Directus static token (${patchResponse.status}): ${describeDirectusErrors(payload)}`,
    );
  }

  const verifyResponse = await fetch(`${directusUrl}/users/me?fields=id`, {
    headers: { Authorization: `Bearer ${staticToken}` },
  });
  if (!verifyResponse.ok) {
    throw new Error(
      `Directus rejected the newly generated static token (${verifyResponse.status})`,
    );
  }

  await updateEnvFile(envFile, staticToken);
  console.log(
    JSON.stringify({
      repaired: true,
      userId,
      environmentFile: envFile,
    }),
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
