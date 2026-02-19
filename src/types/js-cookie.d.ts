declare module "js-cookie" {
  type CookieAttributes = {
    path?: string;
    domain?: string;
    secure?: boolean;
    sameSite?: "strict" | "lax" | "none";
    expires?: number | Date;
  };

  interface CookiesStatic {
    get(name: string): string | undefined;
    get(): Record<string, string>;
    remove(name: string, attributes?: CookieAttributes): void;
  }

  const Cookies: CookiesStatic;

  export default Cookies;
}
