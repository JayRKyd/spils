import * as AppleAuthentication from "expo-apple-authentication";
import * as WebBrowser from "expo-web-browser";
import { getQueryParams } from "expo-auth-session/build/QueryParams";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./supabase";

// Must be listed under Redirect URLs in Supabase Auth -> URL Configuration.
const REDIRECT_TO = "aethera://auth-callback";

/**
 * Native Sign in with Apple -> Supabase session.
 * Returns null if the user cancels the Apple sheet.
 */
export async function signInWithApple(): Promise<Session | null> {
  let credential: AppleAuthentication.AppleAuthenticationCredential;
  try {
    credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
    });
  } catch (e: any) {
    if (e?.code === "ERR_REQUEST_CANCELED") return null;
    throw e;
  }
  if (!credential.identityToken) throw new Error("Apple sign-in returned no identity token.");
  const { data, error } = await supabase.auth.signInWithIdToken({
    provider: "apple",
    token: credential.identityToken,
  });
  if (error) throw error;
  return data.session;
}

/**
 * Google OAuth via an in-app browser session -> Supabase session (PKCE).
 * Returns null if the user closes the browser without finishing.
 */
export async function signInWithGoogle(): Promise<Session | null> {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: REDIRECT_TO, skipBrowserRedirect: true },
  });
  if (error) throw error;

  const result = await WebBrowser.openAuthSessionAsync(data.url, REDIRECT_TO);
  if (result.type !== "success") return null;

  const { params, errorCode } = getQueryParams(result.url);
  if (errorCode) throw new Error(errorCode);
  if (params.error_description) throw new Error(String(params.error_description));
  if (!params.code) throw new Error("Google sign-in returned no auth code.");

  const { data: exchanged, error: exchangeError } = await supabase.auth.exchangeCodeForSession(String(params.code));
  if (exchangeError) throw exchangeError;
  return exchanged.session;
}
