import type { ExpoConfig, ConfigContext } from 'expo/config';

// Everything environment-specific comes from env vars so the same code builds
// dev, staging and production. EXPO_PUBLIC_* values are also inlined into the
// JS bundle; the rest are only used at build time by config plugins.
const env = (name: string, fallback = '') => process.env[name] ?? fallback;

const APP_ENV = env('APP_ENV', 'development');
const isProd = APP_ENV === 'production';
const bundleId = env('APP_BUNDLE_ID', isProd ? 'com.lumo.app' : `com.lumo.app.${APP_ENV}`);

const FACEBOOK_APP_ID = env('FACEBOOK_APP_ID', '000000000000000');
const FACEBOOK_CLIENT_TOKEN = env('FACEBOOK_CLIENT_TOKEN', 'replace-me');
const KAKAO_APP_KEY = env('KAKAO_NATIVE_APP_KEY', 'replace-me');
// Reversed iOS client ID from Google Cloud, e.g. com.googleusercontent.apps.123-abc
const GOOGLE_IOS_URL_SCHEME = env('GOOGLE_IOS_URL_SCHEME', 'com.googleusercontent.apps.replace-me');

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: isProd ? 'Lumo' : `Lumo (${APP_ENV})`,
  slug: 'lumo',
  scheme: 'lumo',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'dark',
  backgroundColor: '#0B0B0F',
  experiments: { typedRoutes: true },
  ios: {
    bundleIdentifier: bundleId,
    supportsTablet: false,
    usesAppleSignIn: true,
    googleServicesFile: env('GOOGLE_SERVICE_INFO_PLIST', './firebase/GoogleService-Info.plist'),
    associatedDomains: [`applinks:${env('EXPO_PUBLIC_WEB_DOMAIN', 'lumo.app')}`],
    infoPlist: {
      UIBackgroundModes: ['audio', 'voip', 'remote-notification'],
      ITSAppUsesNonExemptEncryption: false,
    },
  },
  android: {
    package: bundleId,
    googleServicesFile: env('GOOGLE_SERVICES_JSON', './firebase/google-services.json'),
    adaptiveIcon: {
      backgroundColor: '#0B0B0F',
      foregroundImage: './assets/android-icon-foreground.png',
      backgroundImage: './assets/android-icon-background.png',
      monochromeImage: './assets/android-icon-monochrome.png',
    },
    permissions: [
      'android.permission.CAMERA',
      'android.permission.RECORD_AUDIO',
      'android.permission.MODIFY_AUDIO_SETTINGS',
      'android.permission.BLUETOOTH_CONNECT',
      'android.permission.FOREGROUND_SERVICE',
      'android.permission.FOREGROUND_SERVICE_CAMERA',
      'android.permission.FOREGROUND_SERVICE_MICROPHONE',
      'android.permission.POST_NOTIFICATIONS',
      'com.android.vending.BILLING',
    ],
    predictiveBackGestureEnabled: false,
    intentFilters: [
      {
        action: 'VIEW',
        autoVerify: true,
        data: [{ scheme: 'https', host: env('EXPO_PUBLIC_WEB_DOMAIN', 'lumo.app'), pathPrefix: '/' }],
        category: ['BROWSABLE', 'DEFAULT'],
      },
    ],
  },
  web: { favicon: './assets/favicon.png' },
  plugins: [
    'expo-router',
    'expo-video',
    'expo-image',
    'expo-secure-store',
    'expo-web-browser',
    'expo-font',
    'expo-localization',
    'expo-sharing',
    'expo-apple-authentication',
    '@react-native-firebase/app',
    '@react-native-firebase/messaging',
    '@livekit/react-native-expo-plugin',
    '@config-plugins/react-native-webrtc',
    '@xmartlabs/react-native-line',
    ['@react-native-google-signin/google-signin', { iosUrlScheme: GOOGLE_IOS_URL_SCHEME }],
    [
      'react-native-fbsdk-next',
      {
        appID: FACEBOOK_APP_ID,
        clientToken: FACEBOOK_CLIENT_TOKEN,
        displayName: 'Lumo',
        scheme: `fb${FACEBOOK_APP_ID}`,
        isAutoInitEnabled: true,
        advertiserIDCollectionEnabled: false,
        autoLogAppEventsEnabled: false,
        iosUserTrackingPermission: false,
      },
    ],
    ['@react-native-seoul/kakao-login', { kakaoAppKey: KAKAO_APP_KEY }],
    [
      'expo-camera',
      {
        cameraPermission: 'Lumo uses the camera so you can go live, record videos and scan sign-in QR codes.',
        microphonePermission: 'Lumo uses the microphone so viewers can hear you when you go live or record.',
        recordAudioAndroid: true,
      },
    ],
    [
      'expo-image-picker',
      {
        photosPermission: 'Lumo needs access to your library so you can upload videos and set a profile photo.',
      },
    ],
    ['expo-notifications', { color: '#D61F52' }],
    [
      'expo-build-properties',
      {
        // Firebase and LiveKit need static frameworks on iOS.
        ios: { useFrameworks: 'static', deploymentTarget: '16.4' },
        android: { minSdkVersion: 26, compileSdkVersion: 36, targetSdkVersion: 36 },
      },
    ],
  ],
  extra: {
    appEnv: APP_ENV,
    eas: { projectId: env('EAS_PROJECT_ID') || undefined },
  },
});
