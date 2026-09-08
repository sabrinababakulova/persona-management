/**
 * The client's IP as seen through the reverse proxy.
 *
 * `x-real-ip` is set by nginx from `$remote_addr`, so it is the most reliable value and is
 * preferred. Falling back to `x-forwarded-for`, only the **rightmost** entry is trustworthy:
 * nginx appends the socket peer to whatever the client sent, so every entry to its left is
 * attacker-controlled and using the leftmost one (`split(",")[0]`) makes per-IP rate limits
 * bypassable by sending a fresh header value on each request.
 *
 * Shared by every rate-limited entry point so the auth and profile flows key their counters on
 * the same value.
 */
export function getClientIp(headers: Headers): string {
  const realIp = headers.get("x-real-ip")?.trim();
  if (realIp) {
    return realIp.slice(0, 100);
  }

  const forwardedFor = headers.get("x-forwarded-for");
  if (forwardedFor) {
    const rightmost = forwardedFor
      .split(",")
      .map((ip) => ip.trim())
      .filter(Boolean)
      .at(-1);
    if (rightmost) {
      return rightmost.slice(0, 100);
    }
  }

  return "unknown";
}
