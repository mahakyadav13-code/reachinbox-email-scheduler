/**
 * `cookie-signature` ships without types. It arrives as a transitive dependency
 * of express-session and is used by the API verification script to sign a
 * session cookie the same way the server does.
 */
declare module 'cookie-signature' {
  export function sign(value: string, secret: string): string;
  export function unsign(input: string, secret: string): string | false;
}
