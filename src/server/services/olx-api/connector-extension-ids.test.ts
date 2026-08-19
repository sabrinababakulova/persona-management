import { describe, expect, test } from "bun:test";
import { OLX_CONNECTOR_EXTENSION_ID } from "~/shared/publication-navigation";
import {
  getOlxConnectorExtensionIdFromOrigin,
  parseOlxConnectorExtensionIds,
} from "./connector-extension-ids";

const LOCAL_EXTENSION_ID = "lighdfghidjkkjijohfdoginhhmgjmin";

describe("OLX connector extension allowlist", () => {
  test("always includes the official Web Store ID and exact configured IDs", () => {
    expect(
      parseOlxConnectorExtensionIds(
        OLX_CONNECTOR_EXTENSION_ID,
        `${OLX_CONNECTOR_EXTENSION_ID},${LOCAL_EXTENSION_ID}`,
      ),
    ).toEqual([OLX_CONNECTOR_EXTENSION_ID, LOCAL_EXTENSION_ID]);
  });

  test("accepts only exact Chrome extension origins", () => {
    const allowedIds = [OLX_CONNECTOR_EXTENSION_ID, LOCAL_EXTENSION_ID];

    expect(
      getOlxConnectorExtensionIdFromOrigin(
        `chrome-extension://${LOCAL_EXTENSION_ID}`,
        allowedIds,
      ),
    ).toBe(LOCAL_EXTENSION_ID);
    expect(
      getOlxConnectorExtensionIdFromOrigin(
        `chrome-extension://${LOCAL_EXTENSION_ID}.example`,
        allowedIds,
      ),
    ).toBeNull();
    expect(
      getOlxConnectorExtensionIdFromOrigin(
        `https://${LOCAL_EXTENSION_ID}`,
        allowedIds,
      ),
    ).toBeNull();
    expect(
      getOlxConnectorExtensionIdFromOrigin(
        "chrome-extension://aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        allowedIds,
      ),
    ).toBeNull();
  });
});
