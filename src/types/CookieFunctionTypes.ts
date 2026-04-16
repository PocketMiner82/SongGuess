import type { Cookie, CookieSetOptions } from "universal-cookie";
import type ICookieProps from "./ICookieProps";

/**
 * Function type for setting a cookie value.
 * @param name - The cookie name ('userID' or 'userName')
 * @param value - The cookie value to set
 * @param options - Optional cookie set options
 */
export type CookieSetter = (
  name: "userID" | "userName",
  value: Cookie,
  options?: CookieSetOptions,
) => void;

/**
 * Function type for retrieving all cookie values.
 * @returns An object containing all cookie properties
 */
export type CookieGetter = () => ICookieProps;
