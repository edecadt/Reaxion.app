import { createService } from "@area/sdk";

const SERVICE_ID = "google";

interface GoogleUserInfo {
  sub?: string;
  email?: string;
  name?: string;
  picture?: string;
}

export default createService({
  id: SERVICE_ID,
  name: "Google",
  version: "1.0.0",
  description: "Connect your Google account to enable Google-powered workflows.",
  logo: "https://www.gstatic.com/images/branding/googleg/1x/googleg_standard_color_128dp.png",
  auth: {
    type: "oauth2",
    authorizationUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenUrl: "https://oauth2.googleapis.com/token",
    scopes: ["openid", "email", "profile"],
    clientIdEnvVar: "GOOGLE_CLIENT_ID",
    clientSecretEnvVar: "GOOGLE_CLIENT_SECRET",
    authorizationParams: {
      access_type: "offline",
      prompt: "consent",
      include_granted_scopes: "true",
    },
  },
  onConnect: async (ctx) => {
    if (!ctx.connection?.accessToken) {
      throw new Error("No access token available");
    }

    const response = await fetch(
      "https://openidconnect.googleapis.com/v1/userinfo",
      {
        headers: {
          Authorization: `Bearer ${ctx.connection.accessToken}`,
        },
      },
    );

    if (!response.ok) {
      throw new Error(`Failed to authenticate with Google: ${response.status}`);
    }

    const profile = (await response.json()) as GoogleUserInfo;

    ctx.logger?.log?.(
      `Google connected for account ${profile.email ?? profile.sub ?? "unknown"}`,
      "GoogleService",
    );
  },
});
