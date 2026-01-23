// --- Polyfills (must be first) ---
global.Buffer = global.Buffer || require('buffer').Buffer;
require('react-native-get-random-values');

import 'react-native-gesture-handler';

import { AppRegistry } from 'react-native';
import messaging from '@react-native-firebase/messaging';
import PushNotification from 'react-native-push-notification';

// IMPORTANT: load the actual app entry
import App from './App';

// ---------- Helpers (BlueWallet-like onchain text) ----------
function shortAddress(addr) {
  if (!addr || typeof addr !== 'string') return '';
  if (addr.length <= 12) return addr;
  return `${addr.slice(0, 4)}…${addr.slice(-4)}`; // bc1q…2au9
}

function isConfirmedFromPayload(d) {
  const conf = d && d.confirmations != null ? Number(d.confirmations) : null;
  if (conf != null && !Number.isNaN(conf)) return conf >= 1;

  const status = (d && d.status ? String(d.status) : '').toLowerCase();
  return status === 'confirmed';
}

function buildBlueWalletOnchainText(d) {
  const addrShort = shortAddress(d.address);
  const confirmed = isConfirmedFromPayload(d);

  const amountSat = d && d.amountSat != null ? Number(d.amountSat) : null;
  const hasAmount = amountSat != null && !Number.isNaN(amountSat);

  if (confirmed && hasAmount) {
    return {
      title: `+${amountSat} sats`,
      message: `Received on ${addrShort}`,
    };
  }

  return {
    title: 'New unconfirmed transaction',
    message: `You received new transfer on\n${addrShort}`,
  };
}

// Stable numeric ID so confirmed can overwrite unconfirmed for the same txid
// (MUST fit into signed 32bit int; RNPushNotification parses it as int)
function notifIdFromTxid(txid) {
  if (!txid || typeof txid !== 'string') return Math.floor(Math.random() * 1000000000);

  let hash = 0;
  for (let i = 0; i < txid.length; i++) {
    hash = ((hash << 5) - hash) + txid.charCodeAt(i);
    hash |= 0; // int32
  }

  // keep it positive but still int32-safe
  if (hash < 0) hash = hash * -1;
  return hash;
}

function postLocalNotificationForOnchain(d) {
  const { title, message } = buildBlueWalletOnchainText(d);

  PushNotification.localNotification({
    channelId: d.channelId || 'bluewallet-notifications',
    title,
    message, // IMPORTANT: must be top-level "message"
    bigText: message,
    subText: 'BlueWallet',
    smallIcon: 'ic_notification',

    // overwrite by txid so confirmed can replace unconfirmed
    id: notifIdFromTxid(d.txid),
    tag: d.txid || undefined,

    priority: 'high',
    importance: 'high',
    playSound: true,
    soundName: 'default',
    visibility: 'private',

    userInfo: d,
    data: d,
  });
}

function postLocalNotificationForTest(d) {
  const title = String(d.title || 'BlueWallet');
  const message = String(d.message || d.body || '');

  if (!message) return;

  PushNotification.localNotification({
    channelId: String(d.channelId || 'bluewallet-notifications'),
    title,
    message,
    bigText: message,
    subText: 'BlueWallet',
    smallIcon: 'ic_notification',
    priority: 'high',
    importance: 'high',
    playSound: true,
    soundName: 'default',
    visibility: 'private',
    userInfo: d,
    data: d,
  });
}

async function handleGcMessage(remoteMessage) {
  const d = remoteMessage?.data || {};
  const kind = String(d.kind || '');

  // Only our messages
  if (!['gc_test_data', 'gc_onchain'].includes(kind)) return;

  // Helpful debug (see via: adb logcat | grep ReactNativeJS)
  console.log('[GC] FCM received kind=', kind, 'txid=', d.txid, 'conf=', d.confirmations, 'status=', d.status);

  if (kind === 'gc_onchain') {
    postLocalNotificationForOnchain(d);
    return;
  }

  postLocalNotificationForTest(d);
}

// --- Background handler (FCM data-only -> local notification) ---
messaging().setBackgroundMessageHandler(async remoteMessage => {
  try {
    await handleGcMessage(remoteMessage);
  } catch (e) {
    // swallow errors in headless background
  }
});

// --- Foreground handler (app open) ---
messaging().onMessage(async remoteMessage => {
  try {
    await handleGcMessage(remoteMessage);
  } catch (e) {}
});

// Register app name for Android (matches android/settings.gradle rootProject.name)
AppRegistry.registerComponent('BlueWallet', () => App);
