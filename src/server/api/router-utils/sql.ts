export function escapeLike(value: string) {
  return value.replace(/[%_\\]/g, "\\$&");
}
