import type {Cookie, CookieSetOptions} from "universal-cookie";
import type ICookieProps from "./ICookieProps";

export type CookieSetter = (
    name: "userID" | "userName",
    value: Cookie,
    options?: CookieSetOptions
) => void;

export type CookieGetter = () => ICookieProps;