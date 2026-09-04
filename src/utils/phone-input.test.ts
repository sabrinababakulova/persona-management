import { describe, expect, test } from "bun:test";

import { isPhoneContactType, sanitizePhoneInput } from "./phone-input";

describe("phone input", () => {
  test("keeps common international phone formatting", () => {
    expect(sanitizePhoneInput("+998 (90) 123-45-67")).toBe(
      "+998 (90) 123-45-67",
    );
  });

  test("removes letters and non-phone symbols", () => {
    expect(sanitizePhoneInput("tel: +998 90 123 45 67 ext. 4")).toBe(
      "+998 90 123 45 67 4",
    );
  });

  test("allows a plus sign only at the beginning", () => {
    expect(sanitizePhoneInput("+998+90")).toBe("+99890");
  });

  test("recognizes phone contact fields", () => {
    expect(isPhoneContactType("phone")).toBe(true);
    expect(isPhoneContactType("telegram")).toBe(false);
  });
});
