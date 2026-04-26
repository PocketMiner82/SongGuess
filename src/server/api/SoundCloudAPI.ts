export class SoundCloudAPI {
  // the access token string
  private accessToken?: string;
  // the absolute expiration timestamp in milliseconds
  private expiresAt?: number;

  constructor(private client_id: string, private client_secret: string) {}

  private async getValidToken(): Promise<string> {
    const currentTime = Date.now();
    // Return cached token if it exists and has not reached the expiration threshold
    if (this.accessToken && this.expiresAt && currentTime < this.expiresAt) {
      return this.accessToken;
    }

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
      throw new Error(`Failed to authenticate with SoundCloud: ${response.statusText}`);
    }

    const data = await response.json() as { access_token: string; expires_in: number };

    this.accessToken = data.access_token;
    // Calculate expiration with a 60-second safety buffer to account for network latency
    this.expiresAt = Date.now() + (data.expires_in * 1000) - 60000;

    return this.accessToken;
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
