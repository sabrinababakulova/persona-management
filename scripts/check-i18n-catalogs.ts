import { readFile } from "node:fs/promises";
import { defaultLocale, locales } from "../src/i18n/config";

type MessageNode = string | { [key: string]: MessageNode };

function flattenKeys(node: MessageNode, prefix = ""): string[] {
  if (typeof node === "string") {
    return [prefix];
  }

  return Object.entries(node).flatMap(([key, value]) =>
    flattenKeys(value, prefix ? `${prefix}.${key}` : key),
  );
}

async function readCatalog(locale: string): Promise<MessageNode> {
  const contents = await readFile(
    new URL(`../messages/${locale}.json`, import.meta.url),
    "utf8",
  );
  return JSON.parse(contents) as MessageNode;
}

const referenceKeys = new Set(flattenKeys(await readCatalog(defaultLocale)));
let hasErrors = false;

for (const locale of locales) {
  if (locale === defaultLocale) {
    continue;
  }

  const localeKeys = new Set(flattenKeys(await readCatalog(locale)));
  const missing = [...referenceKeys].filter((key) => !localeKeys.has(key));
  const extra = [...localeKeys].filter((key) => !referenceKeys.has(key));

  if (missing.length > 0 || extra.length > 0) {
    hasErrors = true;
    console.error(`Catalog "${locale}" does not match "${defaultLocale}".`);
    if (missing.length > 0) {
      console.error(`  Missing: ${missing.join(", ")}`);
    }
    if (extra.length > 0) {
      console.error(`  Extra: ${extra.join(", ")}`);
    }
  }
}

if (hasErrors) {
  process.exit(1);
}

console.log(
  `All ${locales.length} catalogs contain the same ${referenceKeys.size} message keys.`,
);
