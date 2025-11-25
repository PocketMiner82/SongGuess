import * as Party from "partykit/server";
import { Buffer } from "buffer";
import { serialize, type SerializeOptions } from "cookie";

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
     * Generates a random string.
     * @param length - The length of the string to return
     * @returns the generated string
     */
    private generateRandomString(length: number): string {
        let text: string = "";
        let possible: string = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
        for (let i: number = 0; i < length; i++) {
            text += possible.charAt(Math.floor(Math.random() * possible.length));
        }
        return text;
    }

    /**
     * Function to extract a specific cookie value from the full Cookie header string.
     * @param headers - The Headers object from the request.
     * @param cookieName - The name of the cookie to retrieve (e.g., "token").
     * @returns The value of the cookie, or null if not found.
     */
    private getCookieValueFromHeaders(headers: Party.Request["headers"], cookieName: string): string|null {
        const cookieHeader = headers.get("Cookie");

        if (!cookieHeader) {
            return null;
        }

        const target = `${cookieName}=`;
        const cookies = cookieHeader.split("; ");

        for (const cookie of cookies) {
            if (cookie.startsWith(target)) {
            const cookieValue = cookie.slice(target.length);
            return decodeURIComponent(cookieValue); 
            }
        }

        return null;
    }

    private getTokenCookieHeaders(access_token:string, expires_in:number, refresh_token:string): Headers {
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

    private getClearTokenCookieHeaders(): Headers {
        const headers = new Headers();
        const options: SerializeOptions = {
            maxAge: 0,
            path: "/",
            sameSite: "strict",
            secure: true
        };
        headers.append('Set-Cookie', serialize("spotify-access-token", "", options));
        headers.append('Set-Cookie', serialize("spotify-refresh-token", "", options));
        return headers;
    }

    private async authLogin(): Promise<Response> {
        var scope = "streaming user-read-email user-read-private user-modify-playback-state user-read-playback-state";
        var state = this.generateRandomString(16);

        var auth_query_parameters = new URLSearchParams({
            response_type: "code",
            client_id: this.spotify_client_id,
            scope: scope,
            redirect_uri: `${this.url.origin}/auth/callback`,
            state: state
        });

        return Response.redirect(`https://accounts.spotify.com/authorize/?${auth_query_parameters.toString()}`);
    }

    private async authCallback(): Promise<Response> {
        const code = this.url.searchParams.get("code");
        if (!code) {
            return new Response("No authorization code received", { status: 400 });
        }

        const spotifyUrl = "https://accounts.spotify.com/api/token";
        const authOptions: RequestInit = {
            method: "POST",
            body: new URLSearchParams({
                code,
                redirect_uri: `${this.url.origin}/auth/callback`,
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
            if (!response.ok) {
                throw new Error(`Got ${response.status}: ${await response.text()}`);
            }

            const json: {
                access_token: string;
                token_type: string;
                expires_in: number;
                refresh_token: string;
                scope: string;
            } = await response.json();
            
            const headers = this.getTokenCookieHeaders(json.access_token, json.expires_in, json.refresh_token);
            headers.set('Location', this.url.origin);

            return new Response(null, {
                status: 302,
                headers: headers
            });
        } catch (err) {
            console.error("Callback", err);
            return new Response("Internal Server Error", { status: 500 });
        }
    }

    private async authRefreshToken(): Promise<Response> {
        const accessToken = this.getCookieValueFromHeaders(this.req.headers, "spotify-access-token");
        const refreshToken = this.getCookieValueFromHeaders(this.req.headers, "spotify-refresh-token");

        if (!refreshToken) {
            return new Response("Refresh token not found", { status: 401 });
        }


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

            if (response.status === 400 || response.status === 401) {
                return new Response("Refresh failed - Session invalid", { 
                    status: 401, 
                    headers: this.getClearTokenCookieHeaders() 
                });
            }

            if (!response.ok) {
                throw new Error(`Got ${response.status}: ${await response.text()}`);
            }

            const json: {
                access_token: string;
                token_type: string;
                expires_in: number;
                refresh_token: string;
                scope: string;
            } = await response.json();

            const headers = this.getTokenCookieHeaders(json.access_token, json.expires_in, json.refresh_token ? json.refresh_token : refreshToken);

            return new Response("success", { headers: headers });
        } catch (err) {
            console.error("Token Refresh", err);
            return new Response("Internal Server Error (token refresh error)", { status: 500 });
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