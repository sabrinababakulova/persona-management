/**
 * Whether NextAuth writes its session cookie under the `__Secure-` prefix.
 *
 * This has to be resolved identically in two places that cannot share a module graph easily:
 * `authConfig` (Node, decides how the cookie is *written*) and `middleware.ts` (edge, decides
 * which name `getToken` *reads*). When the two disagree the middleware finds no token for a
 * perfectly valid session and redirects every gated route to `/login` — a signed-in user stuck
 * in a redirect loop, visible only in whichever environment tripped the mismatch.
 *
 * Reads `process.env` rather than `~/env` so the edge middleware can import it without pulling
 * in the full validated env object.
 */
export function shouldUseSecureCookies(): boolean {
  return process.env.AUTH_URL?.startsWith("https://") ?? false;
}
