import { createClient } from "@/utils/supabase/server";
import { cookies } from "next/headers";

/**
 * Refreshes the Google OAuth access token using a refresh token.
 */
export async function refreshGoogleToken(refreshToken: string) {
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error("Missing Google OAuth credentials (CLIENT_ID or CLIENT_SECRET)");
  }

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    console.error("Failed to refresh Google token:", errorBody);
    throw new Error(`Google token refresh failed: ${errorBody}`);
  }

  const data = await response.json();
  return {
    accessToken: data.access_token,
    expiresIn: data.expires_in,
  };
}

/**
 * Gets a valid Google access token, refreshing it if necessary.
 * This is intended for use in Server actions/routes.
 */
export async function getValidatedProviderToken() {
  const cookieStore = await cookies();
  const providerToken = cookieStore.get("provider_token")?.value;
  const refreshToken = cookieStore.get("provider_refresh_token")?.value;

  // If we have a token, we assume it might still be valid (Client should handle 401 and retry)
  // But more robustly, we can check a 'token_expiry' cookie if we set one.
  // For now, if missing providerToken but have refreshToken, we refresh.
  
  if (!providerToken && refreshToken) {
    console.log("[Auth] Provider token missing, attempting background refresh...");
    try {
      const { accessToken, expiresIn } = await refreshGoogleToken(refreshToken);
      
      // Update the cookie
      cookieStore.set('provider_token', accessToken, {
        path: '/',
        httpOnly: false,
        secure: process.env.NODE_ENV === 'production',
        maxAge: expiresIn - 60 // Buffering
      });
      
      return accessToken;
    } catch (err) {
      console.error("[Auth] Background refresh failed:", err);
      return null;
    }
  }

  return providerToken || null;
}
