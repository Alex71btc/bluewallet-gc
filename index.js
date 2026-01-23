// --- Polyfills (must be first) ---
global.Buffer = global.Buffer || require('buffer').Buffer;
require('react-native-get-random-values');

import 'react-native-gesture-handler';

import { AppRegistry } from 'react-native';
import messaging from '@react-native-firebase/messaging';
import PushNotification from 'react-native-push-notification';

// IMPORTANT: load the actual app entry (BlueWallet may use index.tsx or a different bootstrap)
import App from './App';

// --- Background handler (FCM data-only -> local notification) ---
messaging().setBackgroundMessageHandler(async remoteMessage => {
  try {
    const d = remoteMessage?.data || {};
    const kind = String(d.kind || '');

    if (!['gc_test_data', 'gc_onchain'].includes(kind)) return;

    const address = String(d.address || '');
    const shortAddress = address.length > 12 ? `${address.slice(0, 4)}…${address.slice(-4)}` : address;

    let title = String(d.title || 'BlueWallet');
    let message = String(d.message || d.body || '');

    if (kind === 'gc_onchain') {
      const sats = Number(d.amountSat || 0);
      const status = String(d.status || 'unconfirmed').toLowerCase();
      const isConfirmed = status === 'confirmed';

      if (isConfirmed && Number.isFinite(sats) && sats !== 0) {
        const sign = sats > 0 ? '+' : '';
        title = `${sign}${sats} sats`;
        message = `Received on ${shortAddress}`;
      } else {
        title = 'New unconfirmed transaction';
        message = `You received new transfer on\n${shortAddress}`;
      }
    }

    PushNotification.localNotification({
      channelId: String(d.channelId || 'bluewallet-notifications'),
      title,
      message,
      bigText: message,
      subText: 'BlueWallet',
      smallIcon: 'ic_notification',
      largeIcon: 'ic_launcher_round',
      priority: 'high',
      importance: 'high',
      playSound: true,
      soundName: 'default',
      visibility: 'private',
    });
  } catch (e) {}
});

// Register app name for Android (matches android/settings.gradle rootProject.name)
AppRegistry.registerComponent('BlueWallet', () => App);
