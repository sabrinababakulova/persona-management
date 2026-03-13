export function formatNumberWithSpaces(value: number | string) {
  const digits = String(value).replace(/\D/g, "");
  if (!digits) {
    return "";
  }

  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

export function parseFormattedNumber(value: string): number | undefined {
  const digits = value.replace(/\D/g, "");
  if (!digits) {
    return undefined;
  }

  return Number(digits);
}
