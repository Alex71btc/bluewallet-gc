import messaging from '@react-native-firebase/messaging';
import AsyncStorage from '@react-native-async-storage/async-storage';
import PushNotificationIOS from '@react-native-community/push-notification-ios';
import { AppState, AppStateStatus, Platform } from 'react-native';
import { getApplicationName, getSystemName, getSystemVersion, getVersion, hasGmsSync, hasHmsSync } from 'react-native-device-info';
import { checkNotifications, requestNotifications, RESULTS } from 'react-native-permissions';
import PushNotification, { ReceivedNotification } from 'react-native-push-notification';
import loc from '../loc';
import { groundControlUri } from './constants';
import { fetch } from '../util/fetch';

const PUSH_TOKEN = 'PUSH_TOKEN';
const GROUNDCONTROL_BASE_URI = 'GROUNDCONTROL_BASE_URI';
const NOTIFICATIONS_STORAGE = 'NOTIFICATIONS_STORAGE';
export const NOTIFICATIONS_NO_AND_DONT_ASK_FLAG = 'NOTIFICATIONS_NO_AND_DONT_ASK_FLAG';

let alreadyConfigured = false;
let baseURI = groundControlUri;

type TPushToken = {
  token: string;
  os: string; // 'ios' | 'android'
};

// Unwrapped notification payload
type TPayload = {
  subText?: string;
  message?: string | object;
  foreground: boolean;
  userInteraction: boolean;

  // expected data (from GC server)
  address?: string;
  txid?: string;
  type?: number;
  hash?: string;
};

function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

const _getHeaders = () => ({
  'Access-Control-Allow-Origin': '*',
  'Content-Type': 'application/json',
});

export const isNotificationsCapable = hasGmsSync() || hasHmsSync() || Platform.OS !== 'android';

/**
 * -----------------------
 * Permission / AppState
 * -----------------------
 */

export const checkNotificationPermissionStatus = async () => {
  try {
    const { status } = await checkNotifications();
    return status;
  } catch (error) {
    console.error('Failed to check notification permissions:', error);
    return 'unavailable';
  }
};

let currentPermissionStatus: string = 'unavailable';

const handleAppStateChange = async (nextAppState: AppStateStatus) => {
  if (nextAppState !== 'active') return;

  const isDisabledByUser = (await AsyncStorage.getItem(NOTIFICATIONS_NO_AND_DONT_ASK_FLAG)) === 'true';
  if (isDisabledByUser) return;

  const newStatus = await checkNotificationPermissionStatus();
  if (newStatus !== currentPermissionStatus) {
    currentPermissionStatus = newStatus;
    if (newStatus === 'granted') {
      await initializeNotifications();
    }
  }
};

AppState.addEventListener('change', handleAppStateChange);

export const cleanUserOptOutFlag = async () => {
  return AsyncStorage.removeItem(NOTIFICATIONS_NO_AND_DONT_ASK_FLAG);
};

const checkAndroidNotificationPermission = async () => {
  try {
    const { status } = await checkNotifications();
    return status === RESULTS.GRANTED;
  } catch (err) {
    console.error('Failed to check notification permission:', err);
    return false;
  }
};

/**
 * -----------------------
 * Token handling (Firebase)
 * -----------------------
 */

async function getFirebaseFcmToken(): Promise<string | undefined> {
  try {
    // Android meist ok ohne, iOS braucht es oft:
    await messaging().registerDeviceForRemoteMessages().catch(() => {});
    const token = await messaging().getToken();
    return token || undefined;
  } catch (e) {
    console.error('getFirebaseFcmToken failed:', e);
    return undefined;
  }
}

const _setPushToken = async (token: TPushToken) => {
  await AsyncStorage.setItem(PUSH_TOKEN, JSON.stringify(token));
};

export const getPushToken = async (): Promise<TPushToken | null> => {
  try {
    const raw = await AsyncStorage.getItem(PUSH_TOKEN);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as TPushToken;
    if (!parsed?.token || !parsed?.os) return null;
    return parsed;
  } catch (e) {
    console.error('getPushToken parse error:', e);
    await AsyncStorage.removeItem(PUSH_TOKEN);
    return null;
  }
};

/**
 * -----------------------
 * Main public flow
 * -----------------------
 */

export const tryToObtainPermissions = async () => {
  console.debug('tryToObtainPermissions: user-triggered request');

  if (!isNotificationsCapable) return false;

  try {
    const rationale = {
      title: loc.settings.notifications,
      message: loc.notifications.would_you_like_to_receive_notifications,
      buttonPositive: loc._.ok,
      buttonNegative: loc.notifications.no_and_dont_ask,
    };

    const { status } = await requestNotifications(
      ['alert', 'sound', 'badge'],
      Platform.OS === 'android' && Platform.Version < 33 ? rationale : undefined,
    );

    if (status !== RESULTS.GRANTED) return false;

    return configureNotifications();
  } catch (error) {
    console.error('Error requesting notification permissions:', error);
    return false;
  }
};
export const checkPermissions = async () => {
  return new Promise(resolve => {
    // react-native-push-notification liefert { alert, badge, sound }
    PushNotification.checkPermissions((result: any) => resolve(result));
  });
};

export const configureNotifications = async (onProcessNotifications?: () => void) => {
  if (alreadyConfigured) return true;

  try {
    const { status } = await checkNotifications();
    if (status !== RESULTS.GRANTED) {
      console.debug('configureNotifications: permission not granted');
      return false;
    }

    // already have token?
    const existing = await getPushToken();
    if (existing?.token && existing?.os) {
      alreadyConfigured = true;
      // still configure receiver for taps, etc.
      PushNotification.configure({
        onRegister: () => {},
        onNotification: async (n: any) => handleNotification(n, onProcessNotifications),
        onRegistrationError: (error: any) => console.error('Registration error:', error),
        permissions: { alert: true, badge: true, sound: true },
        popInitialNotification: true,
      });
      return true;
    }

    // get FCM token
    const fcmToken = await getFirebaseFcmToken();
    if (!fcmToken) {
      console.error('configureNotifications: no FCM token');
      return false;
    }

    const token: TPushToken = { token: fcmToken, os: Platform.OS };
    await _setPushToken(token);
    alreadyConfigured = true;

    PushNotification.configure({
      onRegister: () => {
        // token comes from Firebase, do nothing
      },
      onNotification: async (n: any) => handleNotification(n, onProcessNotifications),
      onRegistrationError: (error: any) => console.error('Registration error:', error),
      permissions: { alert: true, badge: true, sound: true },
      popInitialNotification: true,
    });

    // token refresh -> update server
    messaging().onTokenRefresh(async newToken => {
      if (!newToken) return;
      console.log('FCM token refreshed');
      await _setPushToken({ token: newToken, os: Platform.OS });
      await postTokenConfig().catch(() => {});
    });

    return true;
  } catch (e) {
    console.error('configureNotifications failed:', e);
    return false;
  }
};

/**
 * Store notification in app history
 */
export const addNotification = async (notification: TPayload) => {
  let notifications: TPayload[] = [];
  try {
    const raw = await AsyncStorage.getItem(NOTIFICATIONS_STORAGE);
    notifications = raw ? (JSON.parse(raw) as TPayload[]) : [];
    if (!Array.isArray(notifications)) notifications = [];
  } catch {
    notifications = [];
  }

  notifications.push(notification);
  await AsyncStorage.setItem(NOTIFICATIONS_STORAGE, JSON.stringify(notifications));
};

async function handleNotification(notification: Omit<ReceivedNotification, 'userInfo'> & any, onProcessNotifications?: () => void) {
  // merge data into root
  const payload: TPayload = deepClone({
    ...notification,
    ...(notification.data || {}),
  });

  // some servers send nested data.data
  if (notification.data?.data && typeof notification.data.data === 'object') {
    for (const [k, v] of Object.entries(notification.data.data)) {
      if (v != null) (payload as any)[k] = v;
    }
  }

  // persist
  await addNotification(payload);

  // iOS completion
  try {
    notification.finish?.(PushNotificationIOS.FetchResult.NoData);
  } catch {}

  // if app is open, optionally refresh UI
  if (payload.foreground && onProcessNotifications) {
    await onProcessNotifications();
  }
}

/**
 * Called on app launch.
 * No permission prompt here; only config if already allowed.
 */
export const initializeNotifications = async (onProcessNotifications?: () => void) => {
  console.debug('initializeNotifications: start');

  try {
    const disabled = (await AsyncStorage.getItem(NOTIFICATIONS_NO_AND_DONT_ASK_FLAG)) === 'true';
    if (disabled) return;

    const stored = await AsyncStorage.getItem(GROUNDCONTROL_BASE_URI);
    baseURI = stored || groundControlUri;

    PushNotification.setApplicationIconBadgeNumber(0);

    currentPermissionStatus = await checkNotificationPermissionStatus();

    const canProceed =
      Platform.OS === 'android'
        ? isNotificationsCapable && (await checkAndroidNotificationPermission())
        : currentPermissionStatus === 'granted';

    if (!canProceed) return;

    const ok = await configureNotifications(onProcessNotifications);
    if (!ok) return;

    await postTokenConfig();
  } catch (e) {
    console.error('initializeNotifications failed:', e);
    baseURI = groundControlUri;
    await AsyncStorage.setItem(GROUNDCONTROL_BASE_URI, groundControlUri).catch(() => {});
  }
};

/**
 * -----------------------
 * GroundControl API
 * -----------------------
 */

export const majorTomToGroundControl = async (addresses: string[], hashes: string[], txids: string[]) => {
  const disabled = (await AsyncStorage.getItem(NOTIFICATIONS_NO_AND_DONT_ASK_FLAG)) === 'true';
  if (disabled) return;

  if (!Array.isArray(addresses) || !Array.isArray(hashes) || !Array.isArray(txids)) {
    throw new Error('majorTomToGroundControl: bad params');
  }

  const pushToken = await getPushToken();
  if (!pushToken?.token || !pushToken?.os) return;

  const body = JSON.stringify({
    addresses,
    hashes,
    txids,
    token: pushToken.token,
    os: pushToken.os,
  });

  const response = await fetch(`${baseURI}/majorTomToGroundControl`, {
    method: 'POST',
    headers: _getHeaders(),
    body,
  });

  if (!response.ok) {
    throw new Error(`GC majorTomToGroundControl failed: ${response.status} ${response.statusText}`);
  }

  const txt = await response.text();
  if (!txt) return {};
  try {
    return JSON.parse(txt);
  } catch {
    return {};
  }
};

const postTokenConfig = async () => {
  const pushToken = await getPushToken();
  if (!pushToken?.token || !pushToken?.os) return;

  const lang = (await AsyncStorage.getItem('lang')) || 'en';
  const appVersion = `${getSystemName()} ${getSystemVersion()};${getApplicationName()} ${getVersion()}`;

  await fetch(`${baseURI}/setTokenConfiguration`, {
    method: 'POST',
    headers: _getHeaders(),
    body: JSON.stringify({
      token: pushToken.token,
      os: pushToken.os,
      lang,
      app_version: appVersion,
    }),
  });
};

export const setLevels = async (levelAll: boolean) => {
  const pushToken = await getPushToken();
  if (!pushToken?.token || !pushToken?.os) return;

  const response = await fetch(`${baseURI}/setTokenConfiguration`, {
    method: 'POST',
    headers: _getHeaders(),
    body: JSON.stringify({
      level_all: !!levelAll,
      token: pushToken.token,
      os: pushToken.os,
    }),
  });

  if (!response.ok) {
    console.error('Failed to set token configuration:', response.statusText);
    return;
  }

  if (!levelAll) {
    PushNotification.removeAllDeliveredNotifications();
    PushNotification.setApplicationIconBadgeNumber(0);
    PushNotification.cancelAllLocalNotifications();
    await AsyncStorage.setItem(NOTIFICATIONS_NO_AND_DONT_ASK_FLAG, 'true');
  } else {
    await AsyncStorage.removeItem(NOTIFICATIONS_NO_AND_DONT_ASK_FLAG);
  }
};

const getLevels = async () => {
  const pushToken = await getPushToken();
  if (!pushToken?.token || !pushToken?.os) return {};

  try {
    const response = await fetch(`${baseURI}/getTokenConfiguration`, {
      method: 'POST',
      headers: _getHeaders(),
      body: JSON.stringify({
        token: pushToken.token,
        os: pushToken.os,
      }),
    });
    return response.ok ? await response.json() : {};
  } catch {
    return {};
  }
};

export const isNotificationsEnabled = async () => {
  try {
    const disabled = (await AsyncStorage.getItem(NOTIFICATIONS_NO_AND_DONT_ASK_FLAG)) === 'true';
    if (disabled) return false;

    const token = await getPushToken();
    if (!token?.token) return false;

    const levels = await getLevels();
    return !!(levels as any)?.level_all;
  } catch {
    return false;
  }
};

export const unsubscribe = async (addresses: string[], hashes: string[], txids: string[]) => {
  if (!Array.isArray(addresses) || !Array.isArray(hashes) || !Array.isArray(txids)) {
    throw new Error('unsubscribe: bad params');
  }

  const token = await getPushToken();
  if (!token?.token || !token?.os) return;

  const body = JSON.stringify({
    addresses,
    hashes,
    txids,
    token: token.token,
    os: token.os,
  });

  const response = await fetch(`${baseURI}/unsubscribe`, {
    method: 'POST',
    headers: _getHeaders(),
    body,
  });

  if (!response.ok) {
    console.error('Failed to unsubscribe:', response.statusText);
  }
};

export const isGroundControlUriValid = async (uri: string) => {
  try {
    const response = await fetch(`${uri}/ping`, { headers: _getHeaders() });
    const json = await response.json();
    return !!json.description;
  } catch {
    return false;
  }
};

export const getDefaultUri = () => groundControlUri;

export const saveUri = async (uri: string) => {
  baseURI = uri || groundControlUri;
  await AsyncStorage.setItem(GROUNDCONTROL_BASE_URI, baseURI);
};

export const getSavedUri = async () => {
  const baseUriStored = await AsyncStorage.getItem(GROUNDCONTROL_BASE_URI);
  if (baseUriStored) baseURI = baseUriStored;
  return baseUriStored;
};

export const clearStoredNotifications = async () => {
  await AsyncStorage.setItem(NOTIFICATIONS_STORAGE, JSON.stringify([]));
};

export const getStoredNotifications = async (): Promise<TPayload[]> => {
  try {
    const raw = await AsyncStorage.getItem(NOTIFICATIONS_STORAGE);
    const arr = raw ? (JSON.parse(raw) as TPayload[]) : [];
    return Array.isArray(arr) ? arr : [];
  } catch {
    await AsyncStorage.setItem(NOTIFICATIONS_STORAGE, '[]');
    return [];
  }
};

export const getDeliveredNotifications: () => Promise<Record<string, any>[]> = () =>
  new Promise(resolve => PushNotification.getDeliveredNotifications((n: any) => resolve(n)));

export const removeDeliveredNotifications = (identifiers: any[] = []) => {
  PushNotification.removeDeliveredNotifications(identifiers);
};

export const setApplicationIconBadgeNumber = (badges: number) => {
  PushNotification.setApplicationIconBadgeNumber(badges);
};

export const removeAllDeliveredNotifications = () => {
  PushNotification.removeAllDeliveredNotifications();
};
