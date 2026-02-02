import React, { useCallback, useEffect, useState } from 'react';
import { Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useExtendedNavigation } from '../../hooks/useExtendedNavigation';
import loc from '../../loc';
import { SettingsScrollView, SettingsSection, SettingsListItem } from '../../components/platform';

const STORAGE_KEY_LEGACY_URV1_QR = 'LEGACY_URV1_QR';

const General: React.FC = () => {
  console.log('[GeneralHub] mounted');
  const { navigate } = useExtendedNavigation();
  const [legacyUrv1QrEnabled, setLegacyUrv1QrEnabled] = useState<boolean>(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const v = await AsyncStorage.getItem(STORAGE_KEY_LEGACY_URV1_QR);
        setLegacyUrv1QrEnabled(v === '1');
      } catch (_) {
        // ignore
      } finally {
        setLoaded(true);
      }
    })();
  }, []);

  const onToggleLegacy = useCallback(async (value: boolean) => {
    setLegacyUrv1QrEnabled(value);
    try {
      await AsyncStorage.setItem(STORAGE_KEY_LEGACY_URV1_QR, value ? '1' : '0');
    } catch (e) {
      console.warn('Failed to persist LEGACY_URV1_QR', e);
    }
  }, []);

  const goOnLaunch = useCallback(() => {
    // In manchen BlueWallet-Versionen heißt der Screen anders.
    // Wir versuchen zuerst "OnLaunch" – falls es bei dir anders heißt, ändern wir das gleich.
    try {
      // @ts-ignore
      navigate('OnLaunch');
    } catch (e) {
      Alert.alert('On Launch', 'Screen route "OnLaunch" not found. We need to wire this to the correct route name in your repo.');
    }
  }, [navigate]);

  const goPrivacy = useCallback(() => {
    // Dein bisheriger "GeneralSettings" entspricht im Original der "Privacy"-Unterseite.
    navigate('GeneralSettings');
  }, [navigate]);

  return (
    <SettingsScrollView testID="GeneralRoot">
      <SettingsSection horizontalInset={false}>
        <SettingsListItem title="On Launch" chevron onPress={goOnLaunch} position="first" />
        <SettingsListItem title="Privacy" chevron onPress={goPrivacy} position="middle" />
        <SettingsListItem
          title="Legacy URv1 QR"
          switch={{
            value: legacyUrv1QrEnabled,
            onValueChange: onToggleLegacy,
            disabled: !loaded,
          }}
          position="last"
        />
      </SettingsSection>
    </SettingsScrollView>
  );
};

export default General;
