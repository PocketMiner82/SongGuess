import * as Party from "partykit/server";
import { Buffer } from "buffer";
import { serialize } from "cookie";

export default class Auth {
    url: URL;
    req: Party.Request;
    lobby: Party.FetchLobby;
    ctx: Party.ExecutionContext;
    spotify_client_id: string;
    spotify_client_secret: string;

    constructor(url: URL, req: Party.Request, lobby: Party.FetchLobby, ctx: Party.ExecutionContext) {
        this.url = url;
        this.req = req;
        this.lobby = lobby;
        this.ctx = ctx;
        this.spotify_client_id = lobby.env.SPOTIFY_CLIENT_ID == undefined ? "undefined" : lobby.env.SPOTIFY_CLIENT_ID.toString();
        this.spotify_client_secret = lobby.env.SPOTIFY_CLIENT_SECRET == undefined ? "undefined" : lobby.env.SPOTIFY_CLIENT_SECRET.toString();
    }

    /**
     * Function to extract a specific cookie value from the full Cookie header string.
     * @param {Headers} headers - The Headers object from the request.
     * @param {string} cookieName - The name of the cookie to retrieve (e.g., "token").
     * @returns {string | null} The value of the cookie, or null if not found.
     */
    private async getCookieValueFromHeaders(headers: Party.Request["headers"], cookieName: string): Promise<string|null> {
        // 1. Get the entire "Cookie" header string.
        // This is the only method on the Headers object needed for retrieval.
        const cookieHeader = headers.get("Cookie");

        if (!cookieHeader) {
            return null;
        }

        // 2. Format the target name for reliable searching (e.g., "token=")
        const target = `${cookieName}=`;

        // 3. Split the entire cookie string into individual cookie pairs
        // The split delimiter is "; ", which separates cookies.
        const cookies = cookieHeader.split("; ");

        // 4. Iterate over the pairs and find the one that starts with our target name.
        for (const cookie of cookies) {
            if (cookie.startsWith(target)) {
            // 5. Extract the value:
            // We slice the string, starting after the length of "token="
            // This retrieves "your_actual_token_value".
            const cookieValue = cookie.slice(target.length);
            
            // Cookies can be URL-encoded, so we decode it for use.
            // This is a standard JavaScript function, not part of the Headers interface.
            return decodeURIComponent(cookieValue); 
            }
        }

        // If the loop completes without finding the cookie, return null.
        return null;
    }

    private async generateRandomString(length: number): Promise<string> {
        let text: string = "";
        let possible: string = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
        for (let i: number = 0; i < length; i++) {
            text += possible.charAt(Math.floor(Math.random() * possible.length));
        }
        return text;
    }

    private async authLogin(): Promise<Response> {
        var scope = "streaming \
user-read-email \
user-read-private";
        var state = await this.generateRandomString(16);
        var auth_query_parameters = new URLSearchParams({
            response_type: "code",
            client_id: this.spotify_client_id,
            scope: scope,
            redirect_uri: this.url.origin + "/auth/callback",
            state: state
        });
        return Response.redirect("https://accounts.spotify.com/authorize/?" + auth_query_parameters.toString());
    }

    private async getTokenCookieHeaders(access_token:string, expires_in:number, refresh_token:string): Promise<Headers> {
        const accessTokenCookie = serialize("spotify-access-token", access_token, {
            maxAge: expires_in,
            path: "/",
            sameSite: "strict",
            httpOnly: false,
            secure: true
        });

        const refreshTokenCookie = serialize("spotify-refresh-token", refresh_token, {
            maxAge: 60 * 60 * 24 * 30,
            path: "/",
            sameSite: "strict",
            httpOnly: true,
            secure: true,
        });

        const headers = new Headers();
        headers.append('Set-Cookie', accessTokenCookie);
        headers.append('Set-Cookie', refreshTokenCookie);

        return headers;
    }

    private async authCallback(): Promise<Response> {
        let code = this.url.searchParams.get("code");
        if (!code) {
            return new Response("No authorization code received", { status: 400 });
        }

        const spotifyUrl = "https://accounts.spotify.com/api/token";
        const authOptions: RequestInit = {
            method: "POST",
            body: new URLSearchParams({
                code,
                redirect_uri: this.url.origin + "/auth/callback",
                grant_type: "authorization_code",
            }),
            headers: {
                Authorization:
                    "Basic " +
                    Buffer.from(this.spotify_client_id + ":" + this.spotify_client_secret).toString(
                    "base64"
                    ),
                "Content-Type": "application/x-www-form-urlencoded",
            },
        };

        try {
            const response = await fetch(spotifyUrl, authOptions);
            const json: {
                access_token: string;
                token_type: string;
                expires_in: number;
                refresh_token: string;
                scope: string;
            } = await response.json();

            if (!response.ok || response.status != 200) {
                throw new Error("Got non OK status code:\n" + response.status + " " + response.statusText);
            }
            
            const headers = await this.getTokenCookieHeaders(json.access_token, json.expires_in, json.refresh_token);
            headers.set('Location', this.url.origin);

            return new Response(null, {
                status: 302,
                headers: headers
            });
        } catch (err) {
            console.error("callback", err);
            return new Response("Internal Server Error (callback error)", { status: 500 });
        }
    }

    private async authRefreshToken(): Promise<Response> {
        const accessToken = await this.getCookieValueFromHeaders(this.req.headers, "spotify-access-token");
        const refreshToken = await this.getCookieValueFromHeaders(this.req.headers, "spotify-refresh-token");

        if (accessToken) {
            return new Response("refresh_not_necessary");
        } else if (refreshToken) {
            const spotifyUrl = "https://accounts.spotify.com/api/token";
            const authOptions: RequestInit = {
                method: "POST",
                body: new URLSearchParams({
                    grant_type: "refresh_token",
                    refresh_token: refreshToken
                }),
                headers: {
                    Authorization:
                        "Basic " +
                        Buffer.from(this.spotify_client_id + ":" + this.spotify_client_secret).toString(
                        "base64"
                        ),
                    "Content-Type": "application/x-www-form-urlencoded",
                },
            };

            try {
                const response = await fetch(spotifyUrl, authOptions);
                const json: {
                    access_token: string;
                    token_type: string;
                    expires_in: number;
                    refresh_token: string;
                    scope: string;
                } = await response.json();

                if (!response.ok || response.status != 200) {
                    throw new Error("Got non OK status code:\n" + response.status + " " + response.statusText);
                }
                const headers = await this.getTokenCookieHeaders(json.access_token, json.expires_in, json.refresh_token ? json.refresh_token : refreshToken);

                return new Response("token_refreshed", { headers: headers });
            } catch (err) {
                console.error("token refresh", err);
                return new Response("Internal Server Error (token refresh error)", { status: 500 });
            }
        } else {
            return new Response("refresh_token_not_found", { status: 400 });
        }
    }

    async onAuthRequest(): Promise<Response> {
        // get all messages
        if (this.req.method === "GET" && this.url.pathname == "/auth/login") {
            return this.authLogin();
        } else if (this.req.method === "GET" && this.url.pathname == "/auth/callback") {
            return this.authCallback();
        } else if (this.req.method === "GET" && this.url.pathname == "/auth/refreshToken") {
            return this.authRefreshToken();
        }
        return new Response("Method not allowed", { status: 405 });
    }
}