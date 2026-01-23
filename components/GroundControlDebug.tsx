import messaging from '@react-native-firebase/messaging';
import React from 'react';
import { Alert, ScrollView, Text, View } from 'react-native';
import Clipboard from '@react-native-clipboard/clipboard';
import { useStorage } from '../hooks/context/useStorage';
import {
  gcAuthNonce,
  gcHealth,
  gcInfo,
  gcLoadToken,
  gcMe,
  gcPingAuth,
  gcPushMe,
  gcPushRegister,
  gcSaveToken,
  gcVerify,
} from '../gc/api';
import { Button } from './Button';
import { BlueSpacing } from './BlueSpacing';
import { Header } from './Header';

const GroundControlDebug = () => {
  const { wallets } = useStorage();

  const [loading, setLoading] = React.useState(false);

  const [health, setHealth] = React.useState<string | null>(null);
  const [info, setInfo] = React.useState<any>(null);
  const [nonceObj, setNonceObj] = React.useState<{ nonce: string; expiresInSec: number } | null>(null);
  const [pushReg, setPushReg] = React.useState<any>(null);
  const [pushMe, setPushMe] = React.useState<any>(null);

  const [selectedWalletID, setSelectedWalletID] = React.useState<string | null>(null);
  const [selectedWalletLabel, setSelectedWalletLabel] = React.useState<string | null>(null);

  const [signingAddress, setSigningAddress] = React.useState<string | null>(null);
  const [signature, setSignature] = React.useState<string | null>(null);

  const [verifyResult, setVerifyResult] = React.useState<any>(null);
  const [token, setToken] = React.useState<string | null>(null);

  const [me, setMe] = React.useState<any>(null);
  const [pingAuth, setPingAuth] = React.useState<any>(null);

  const [error, setError] = React.useState<string | null>(null);

  // Load token whenever this screen mounts
  React.useEffect(() => {
    (async () => {
      try {
        const t = await gcLoadToken();
        if (t) setToken(t);
      } catch (e: any) {
        // don't block UI on token load
        console.log('[GC] gcLoadToken error:', e);
      }
    })();
  }, []);

  const clearAll = () => {
    setHealth(null);
    setInfo(null);
    setNonceObj(null);

    setSignature(null);
    setSigningAddress(null);

    setVerifyResult(null);
    setMe(null);
    setPingAuth(null);

    setError(null);
  };

  const logout = async () => {
    setLoading(true);
    setError(null);
    try {
      await gcSaveToken(null);
      setToken(null);
      setVerifyResult(null);
      setMe(null);
      setPingAuth(null);
    } catch (e: any) {
      setError(String(e?.message ?? e));
    } finally {
      setLoading(false);
    }
  };

  const pickWallet = () => {
    const signable = wallets.filter(w => typeof (w as any).signMessage === 'function');

    if (signable.length === 0) {
      Alert.alert('No signable wallet', 'Create or import a wallet that can sign messages (not watch-only).');
      return;
    }

    const showWallet = (index: number) => {
      const w = signable[index % signable.length];
      Alert.alert(
        'Select wallet',
        `Selected: ${w.getLabel()}`,
        [
          {
            text: 'Select',
            onPress: () => {
              setSelectedWalletID(w.getID());
              setSelectedWalletLabel(w.getLabel());
              setSignature(null);
              setSigningAddress(null);
              setVerifyResult(null);
              setMe(null);
              setPingAuth(null);
            },
          },
          { text: 'Next', onPress: () => showWallet(index + 1) },
          { text: 'Cancel', style: 'cancel' },
        ],
        { cancelable: true },
      );
    };

    showWallet(0);
  };

  const fetchBasics = async () => {
    setLoading(true);
    setError(null);
    try {
      setHealth(await gcHealth());
      setInfo(await gcInfo());
    } catch (e: any) {
      setError(String(e?.message ?? e));
    } finally {
      setLoading(false);
    }
  };

  const authFetchSignVerify = async () => {
    if (!selectedWalletID) {
      setError('No wallet selected.');
      return;
    }

    const w = wallets.find(x => x.getID() === selectedWalletID);
    if (!w || typeof (w as any).signMessage !== 'function') {
      setError('Selected wallet cannot sign messages.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // 1) fetch nonce
      const n = await gcAuthNonce();
      setNonceObj(n);
      const nonce = String(n.nonce);

      // 2) resolve address
      let addr: any = null;
      if (typeof (w as any).getAddressAsync === 'function') {
        addr = await (w as any).getAddressAsync();
      } else if (typeof (w as any).getAddress === 'function') {
        addr = (w as any).getAddress();
        if (addr && typeof addr.then === 'function') addr = await addr;
      }

      if (typeof addr !== 'string' || addr.length < 10) {
        throw new Error(`Wallet returned invalid address: ${String(addr)}`);
      }
      setSigningAddress(addr);

      // 3) sign (prefer msg+addr)
      let sig: any;
      try {
        sig = await (w as any).signMessage(nonce, addr);
      } catch {
        sig = await (w as any).signMessage(nonce);
      }
      setSignature(String(sig));

      // 4) verify (server returns token)
      const v = await gcVerify(nonce, String(sig), String(addr));
      setVerifyResult(v);

      if (v?.token) {
        await gcSaveToken(v.token);
        setToken(v.token);
      } else {
        await gcSaveToken(null);
        setToken(null);
      }
    } catch (e: any) {
      setError(String(e?.message ?? e));
    } finally {
      setLoading(false);
    }
  };

  const runMe = async () => {
    setLoading(true);
    setError(null);
    try {
      setMe(await gcMe());
    } catch (e: any) {
      setError(String(e?.message ?? e));
    } finally {
      setLoading(false);
    }
  };

  const runPingAuth = async () => {
    setLoading(true);
    setError(null);
    try {
      setPingAuth(await gcPingAuth());
    } catch (e: any) {
      setError(String(e?.message ?? e));
    } finally {
      setLoading(false);
    }
  };

  const copySignature = () => {
    if (signature) Clipboard.setString(signature);
  };
const runRegisterPush = async () => {
  setLoading(true);
  setError(null);
  try {
    // Android 13+ / allgemein nötig
    await messaging().requestPermission();

    // stellt sicher, dass das Device bei FCM registriert ist
    await messaging().registerDeviceForRemoteMessages();

    const fcmToken = await messaging().getToken();

    console.log('[GC] FCM token:', fcmToken);

    const res = await gcPushRegister({
      platform: 'android',
      token: fcmToken,
    });

    setPushReg(res);
  } catch (e: any) {
    setError(String(e?.message ?? e));
  } finally {
    setLoading(false);
  }
};

const runPushMe = async () => {
  setLoading(true);
  setError(null);
  try {
    const r = await gcPushMe();
    setPushMe(r);
  } catch (e: any) {
    setError(String(e?.message ?? e));
  } finally {
    setLoading(false);
  }
};
const runPushRegisterFCM = async () => {
  setLoading(true);
  setError(null);

  try {
    // Android 13+ (POST_NOTIFICATIONS)
    await messaging().requestPermission();

    const fcmToken = await messaging().getToken();
    if (!fcmToken) {
      throw new Error('FCM token is empty');
    }

    console.log('[GC] FCM token:', fcmToken);

    const r = await gcPushRegister('android', fcmToken);
    setPushReg(r);
  } catch (e: any) {
    setError(String(e?.message ?? e));
  } finally {
    setLoading(false);
  }
};

  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic">
      <Header leftText="GroundControl Debug" />
      <BlueSpacing />

      <View style={{ paddingHorizontal: 16, gap: 12 }}>
        <Button title="Fetch: /health + /gc/info" onPress={fetchBasics} disabled={loading} />
        <Button title="Select wallet (for signing)" onPress={pickWallet} disabled={loading} />
        <Button title="Auth: Fetch → Sign → Verify" onPress={authFetchSignVerify} disabled={loading} />

        <Button title="GC: /gc/me (JWT)" onPress={runMe} disabled={loading || !token} />
        <Button title="GC: /gc/ping-auth (JWT)" onPress={runPingAuth} disabled={loading || !token} />

        <Button title="Copy signature" onPress={copySignature} disabled={!signature} />
        <Button title="Logout (clear token)" onPress={logout} disabled={loading} />
        <Button title="Clear (UI only)" onPress={clearAll} disabled={loading} />
        <Button title="Register push (FCM)" onPress={runRegisterPush} />
        <Button title="GC: /gc/push/me" onPress={runPushMe} disabled={loading || !token} />
<Button
  title="GC: /gc/push/register (FCM)"
  onPress={runPushRegisterFCM}
  disabled={loading || !token}
/>
<Button
  title="Copy JWT token"
  onPress={() => token && Clipboard.setString(token)}
  disabled={!token}
/>


        {!!error && (
          <View style={{ padding: 12, borderWidth: 1 }}>
            <TextBlock title="Error" value={error} />
          </View>
        )}

        <View style={{ padding: 12, borderWidth: 1 }}>
          <TextBlock title="Health" value={health ?? '(not fetched)'} />
        </View>

        <View style={{ padding: 12, borderWidth: 1 }}>
          <TextBlock title="Info" value={info ? JSON.stringify(info, null, 2) : '(not fetched)'} />
        </View>

        <View style={{ padding: 12, borderWidth: 1 }}>
          <TextBlock title="Nonce" value={nonceObj ? JSON.stringify(nonceObj, null, 2) : '(none)'} />
        </View>

        <View style={{ padding: 12, borderWidth: 1 }}>
          <TextBlock title="Selected wallet" value={selectedWalletLabel ?? '(none)'} />
        </View>

        <View style={{ padding: 12, borderWidth: 1 }}>
          <TextBlock title="Signing address" value={signingAddress ?? '(unknown)'} />
        </View>

        <View style={{ padding: 12, borderWidth: 1 }}>
          <TextBlock title="Signature" value={signature ?? '(not signed)'} />
        </View>

        <View style={{ padding: 12, borderWidth: 1 }}>
          <TextBlock title="Verify result" value={verifyResult ? JSON.stringify(verifyResult, null, 2) : '(not verified)'} />
        </View>

        <View style={{ padding: 12, borderWidth: 1 }}>
          <TextBlock title="Token" value={token ?? '(none)'} />
        </View>

        <View style={{ padding: 12, borderWidth: 1 }}>
          <TextBlock title="/gc/me" value={me ? JSON.stringify(me, null, 2) : '(not fetched)'} />
        </View>
<View style={{ padding: 12, borderWidth: 1 }}>
  <TextBlock title="/gc/push/register" value={pushReg ? JSON.stringify(pushReg, null, 2) : '(not called)'} />
</View>

<View style={{ padding: 12, borderWidth: 1 }}>
  <TextBlock title="/gc/push/me" value={pushMe ? JSON.stringify(pushMe, null, 2) : '(not fetched)'} />
</View>

        <View style={{ padding: 12, borderWidth: 1 }}>
          <TextBlock title="/gc/ping-auth" value={pingAuth ? JSON.stringify(pingAuth, null, 2) : '(not fetched)'} />
        </View>
      </View>

      <BlueSpacing />
    </ScrollView>
  );
};

const TextBlock = ({ title, value }: { title: string; value: string }) => (
  <>
    <Text style={{ fontWeight: '600', marginBottom: 6 }}>{title}</Text>
    <Text style={{ fontFamily: 'monospace' }}>{value}</Text>
  </>
);

export default GroundControlDebug;
