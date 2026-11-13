import * as AppleAuthentication from 'expo-apple-authentication';
import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';
import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';
import { AccessToken, AuthenticationToken, LoginManager } from 'react-native-fbsdk-next';
import LineLogin, { Scope as LineScope } from '@xmartlabs/react-native-line';
import * as Kakao from '@react-native-seoul/kakao-login';
import { config } from '../config';
import { randomString, sha256Hex } from '../device';
import type { OAuthProvider, ProviderCredential } from '../api/types';

WebBrowser.maybeCompleteAuthSession();

/** Thrown when the user backs out of a provider sheet. Screens ignore it. */
export class SignInCancelled extends Error {
  constructor() {
    super('cancelled');
    this.name = 'SignInCancelled';
  }
}

export const isCancelled = (e: unknown) => e instanceof SignInCancelled;

let googleConfigured = false;
let lineConfigured = false;

/**
 * Runs the provider's native (or PKCE browser) flow and returns the
 * credential the identity service verifies. No provider token is stored on
 * the device; the backend exchanges and discards them.
 */
export async function providerCredential(provider: OAuthProvider): Promise<ProviderCredential> {
  switch (provider) {
    case 'google':
      return google();
    case 'apple':
      return apple();
    case 'facebook':
      return facebook();
    case 'x':
      return x();
    case 'line':
      return line();
    case 'kakao':
      return kakao();
  }
}

/** Which buttons to show on this platform. Apple is iOS-only by policy here. */
export async function availableProviders(): Promise<OAuthProvider[]> {
  const list: OAuthProvider[] = ['google'];
  if (Platform.OS === 'ios' && (await AppleAuthentication.isAvailableAsync().catch(() => false))) list.push('apple');
  list.push('facebook', 'x', 'line', 'kakao');
  return list;
}

async function google(): Promise<ProviderCredential> {
  if (!googleConfigured) {
    GoogleSignin.configure({
      webClientId: config.google.webClientId || undefined,
      iosClientId: config.google.iosClientId || undefined,
      scopes: ['email', 'profile'],
    });
    googleConfigured = true;
  }
  if (Platform.OS === 'android') await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
  try {
    // Fresh account chooser each time so "switch account" works.
    await GoogleSignin.signOut().catch(() => undefined);
    const res = await GoogleSignin.signIn();
    if (res.type !== 'success') throw new SignInCancelled();
    if (!res.data.idToken) throw new Error('Google did not return an ID token. Check the web client ID.');
    return { id_token: res.data.idToken };
  } catch (e) {
    if (isCancelled(e)) throw e;
    const code = (e as { code?: string }).code;
    if (code === statusCodes.SIGN_IN_CANCELLED || code === statusCodes.IN_PROGRESS) throw new SignInCancelled();
    throw e;
  }
}

async function apple(): Promise<ProviderCredential> {
  // Apple embeds whatever nonce we pass; we pass SHA-256(raw) and send raw to
  // the server, which accepts either form.
  const raw = randomString(32);
  try {
    const cred = await AppleAuthentication.signInAsync({
      requestedScopes: [AppleAuthentication.AppleAuthenticationScope.FULL_NAME, AppleAuthentication.AppleAuthenticationScope.EMAIL],
      nonce: await sha256Hex(raw),
    });
    if (!cred.identityToken) throw new Error('Apple did not return an identity token.');
    const fullName = cred.fullName ? AppleAuthentication.formatFullName(cred.fullName) : '';
    return { id_token: cred.identityToken, nonce: raw, full_name: fullName || undefined };
  } catch (e) {
    if ((e as { code?: string }).code === 'ERR_REQUEST_CANCELED') throw new SignInCancelled();
    throw e;
  }
}

async function facebook(): Promise<ProviderCredential> {
  if (Platform.OS === 'ios') {
    // iOS: Limited Login returns an OIDC token bound to our nonce.
    const nonce = randomString(24);
    const res = await LoginManager.logInWithPermissions(['public_profile', 'email'], 'limited', nonce);
    if (res.isCancelled) throw new SignInCancelled();
    const tok = await AuthenticationToken.getAuthenticationTokenIOS();
    if (!tok?.authenticationToken) throw new Error('Facebook did not return a token.');
    return { id_token: tok.authenticationToken, nonce };
  }
  const res = await LoginManager.logInWithPermissions(['public_profile', 'email']);
  if (res.isCancelled) throw new SignInCancelled();
  const tok = await AccessToken.getCurrentAccessToken();
  if (!tok?.accessToken) throw new Error('Facebook did not return a token.');
  return { access_token: tok.accessToken };
}

const xDiscovery: AuthSession.DiscoveryDocument = {
  authorizationEndpoint: 'https://x.com/i/oauth2/authorize',
  tokenEndpoint: 'https://api.x.com/2/oauth2/token',
  revocationEndpoint: 'https://api.x.com/2/oauth2/revoke',
};

async function x(): Promise<ProviderCredential> {
  if (!config.xClientId) throw new Error('X sign-in is not configured.');
  const redirectUri = AuthSession.makeRedirectUri({ scheme: 'lumo', path: 'oauth/x' });
  const req = new AuthSession.AuthRequest({
    clientId: config.xClientId,
    redirectUri,
    scopes: ['users.read', 'tweet.read', 'offline.access'],
    usePKCE: true,
    responseType: AuthSession.ResponseType.Code,
  });
  const result = await req.promptAsync(xDiscovery);
  if (result.type !== 'success') {
    if (result.type === 'error') throw new Error(result.error?.message ?? 'X sign-in failed.');
    throw new SignInCancelled();
  }
  const code = result.params.code;
  if (!code || !req.codeVerifier) throw new Error('X sign-in failed.');
  // The identity service exchanges the code server-side; nothing is stored here.
  return { code, code_verifier: req.codeVerifier, redirect_uri: redirectUri };
}

async function line(): Promise<ProviderCredential> {
  if (!lineConfigured) {
    if (!config.lineChannelId) throw new Error('LINE sign-in is not configured.');
    await LineLogin.setup({ channelId: config.lineChannelId });
    lineConfigured = true;
  }
  try {
    const res = await LineLogin.login({ scopes: [LineScope.OpenId, LineScope.Profile, LineScope.Email] });
    const idToken = res.accessToken.idToken;
    if (!idToken) throw new Error('LINE did not return an ID token. Enable OpenID Connect on the channel.');
    return { id_token: idToken, nonce: res.idTokenNonce };
  } catch (e) {
    const msg = String((e as Error).message ?? '');
    if (/cancel/i.test(msg)) throw new SignInCancelled();
    throw e;
  }
}

async function kakao(): Promise<ProviderCredential> {
  try {
    const tok = await Kakao.login();
    if (!tok.idToken) throw new Error('Kakao did not return an ID token. Enable OpenID Connect in Kakao Developers.');
    return { id_token: tok.idToken };
  } catch (e) {
    const msg = String((e as Error).message ?? '');
    if (/cancel/i.test(msg)) throw new SignInCancelled();
    throw e;
  }
}

export const providerLabels: Record<OAuthProvider, string> = {
  google: 'Google',
  apple: 'Apple',
  facebook: 'Facebook',
  x: 'X',
  line: 'LINE',
  kakao: 'Kakao',
};
