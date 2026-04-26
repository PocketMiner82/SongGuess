import type * as Party from "partykit/server";


export class SoundCloudAPI {
  constructor(readonly room: Party.Room, private client_id: string, private client_secret: string) {}

  // the access token string
  private async getAccessToken(): Promise<string | undefined> {
    return await this.room.storage.get<string>("accessToken");
  }

  private async getRefreshToken(): Promise<string | undefined> {
    return await this.room.storage.get<string>("refreshToken");
  }

  // the absolute expiration timestamp in milliseconds
  private async getExpiresAt(): Promise<number | undefined> {
    return await this.room.storage.get<number>("expiresAt");
  }

  private async clientCredentialsAuth(): Promise<string> {
    // Encode credentials for Basic Authentication
    const credentials = btoa(`${this.client_id}:${this.client_secret}`);

    // Request a new token using the client_credentials grant type
    const response = await fetch("https://secure.soundcloud.com/oauth/token", {
      method: "POST",
      headers: {
        "Authorization": `Basic ${credentials}`,
        "Content-Type": "application/x-www-form-urlencoded",
        "Accept": "application/json; charset=utf-8",
      },
      body: new URLSearchParams({
        grant_type: "client_credentials",
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to authenticate with SoundCloud:\n${await response.text()}`);
    }

    const data = await response.json() as {
      access_token: string;
      expires_in: number;
      refresh_token: string;
    };

    await Promise.all([
      this.room.storage.put("accessToken", data.access_token),
      // Calculate expiration with a 60-second safety buffer to account for network latency
      this.room.storage.put("expiresAt", Date.now() + (data.expires_in * 1000) - 60000),
    ]);

    return data.access_token;
  }

  private async refreshToken(refreshToken: string): Promise<string> {
    const response = await fetch("https://secure.soundcloud.com/oauth/token", {
      method: "POST",
      headers: {
        "Accept": "application/json; charset=utf-8",
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        client_id: this.client_id,
        client_secret: this.client_secret,
        refresh_token: refreshToken,
      }),
    });

    if (!response.ok) {
      throw new Error(`SoundCloud OAuth token refresh operation failed:\n${await response.text()}`);
    }

    const data = await response.json() as {
      access_token: string;
      refresh_token: string;
      expires_in: number;
    };

    await Promise.all([
      this.room.storage.put("accessToken", data.access_token),
      this.room.storage.put("refreshToken", data.refresh_token),
      this.room.storage.put("expiresAt", Date.now() + (data.expires_in * 1000) - 60000),
    ]);

    return data.access_token;
  }

  private async getValidToken(): Promise<string> {
    const currentTime = Date.now();
    const accessToken = await this.getAccessToken();
    const expiresAt = await this.getExpiresAt();

    // Return cached token if it exists and has not reached the expiration threshold
    if (accessToken && expiresAt && currentTime < expiresAt) {
      return accessToken;
    }

    const refreshToken = await this.getRefreshToken();

    if (refreshToken) {
      // token expired, try refreshing first
      try {
        return this.refreshToken(refreshToken);
      } catch { }
    }

    return this.clientCredentialsAuth();
  }

  async fetchGetJson(uri: string, params?: ConstructorParameters<typeof URLSearchParams>[0]): Promise<any> {
    const response = await this.fetchGet(uri, params);
    return response.json();
  }

  async fetchGet(uri: string, params?: ConstructorParameters<typeof URLSearchParams>[0]): Promise<Response> {
    return await this.fetch(uri, "GET", params);
  }

  async fetch(uri: string, method: string, params?: ConstructorParameters<typeof URLSearchParams>[0]): Promise<Response> {
    const token = await this.getValidToken();
    const url = new URL(uri, "https://api.soundcloud.com");

    // Append search parameters to the URL if provided
    if (params) {
      const searchParams = new URLSearchParams(params);
      searchParams.forEach((value, key) => {
        url.searchParams.append(key, value);
      });
    }

    // Execute the request with the specific SoundCloud OAuth header format
    return await fetch(url.href, {
      method,
      headers: {
        Authorization: `OAuth ${token}`,
        Accept: "application/json; charset=utf-8",
      },
    });
  }
}

export interface SoundCloudStreams {
  hls_aac_160_url?: string;
  http_mp3_128_url?: string;
  hls_mp3_128_url?: string;
  preview_mp3_128_url?: string;
}
