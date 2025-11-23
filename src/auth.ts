import * as Party from "partykit/server";

export default class AuthServer implements Party.Server {
    constructor(readonly room: Party.Room) {}

    generateRandomString(length: number): string {
        let text: string = "";
        let possible: string = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
        for (let i: number = 0; i < length; i++) {
            text += possible.charAt(Math.floor(Math.random() * possible.length));
        }
        return text;
    }

    async onRequest(req: Party.Request) {
        const spotify_client_id: string = this.room.env.SPOTIFY_CLIENT_ID == undefined ? "" : this.room.env.SPOTIFY_CLIENT_ID.toString();
        const spotify_client_secret: string = this.room.env.SPOTIFY_CLIENT_SECRET == undefined ? "" : this.room.env.SPOTIFY_CLIENT_SECRET.toString();

        // get all messages
        if (req.method === "GET" && this.room.id == "login") {
            var scope = "streaming \
user-read-email \
user-read-private";
            var state = this.generateRandomString(16);
            var auth_query_parameters = new URLSearchParams({
                response_type: "code",
                client_id: spotify_client_id,
                scope: scope,
                redirect_uri: new URL(req.url).origin + "/parties/auth/callback",
                state: state
            });
            return Response.redirect("https://accounts.spotify.com/authorize/?" + auth_query_parameters.toString());
        } else if (req.method === "GET" && this.room.id == "callback") {
            const code = new URL(req.url).searchParams.get("code");
            if (!code) {
                return new Response("No authorization code received", { status: 400 });
            }

            const url = 'https://accounts.spotify.com/api/token';
            const authOptions: RequestInit = {
                method: 'POST',
                body: new URLSearchParams({
                code,
                redirect_uri: new URL(req.url).origin + "/parties/auth/callback",
                grant_type: 'authorization_code',
                }),
                headers: {
                Authorization:
                    'Basic ' +
                    Buffer.from(spotify_client_id + ':' + spotify_client_secret).toString(
                    'base64',
                    ),
                'Content-Type': 'application/x-www-form-urlencoded',
                },
            };
            try {
                const response = await fetch(url, authOptions);
                const json: {
                access_token: string;
                token_type: string;
                expires_in: number;
                refresh_token: string;
                scope: string;
                } = await response.json();

                if (!response.ok) {
                    throw new Error("Got non OK status code:\n" + response.status + " " + response.statusText);
                }

                const access_token = json.access_token;
                console.log(access_token);
                return Response.redirect(new URL(req.url).origin);

                // const setCookie = cookie.serialize(
                // 'spotify-access-token',
                // json.access_token,
                // {
                //     maxAge: json.expires_in,
                //     sameSite: 'strict',
                //     httpOnly: true,
                // },
                // );
                // res.setHeader('Set-Cookie', setCookie);

                // res.redirect('/');
            } catch (err) {
                console.error('callback err', err);
                return new Response("Internal Server Error (callback error)", { status: 500 });
            }
        }
        return new Response("Method not allowed", { status: 405 });
    }
}