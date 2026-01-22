import type {Cookie, CookieSetOptions} from "universal-cookie";
import type CookieProps from "./CookieProps";

export type CookieSetter = (
    name: "userID" | "userName",
    value: Cookie,
    options?: CookieSetOptions
) => void;

export type CookieGetter = () => CookieProps;