import React, { useMemo, useLayoutEffect, useCallback } from 'react';
import { View, StyleSheet, Platform, StatusBar, Linking, Image } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useExtendedNavigation } from '../../hooks/useExtendedNavigation';
import loc from '../../loc';
import { SettingsScrollView, SettingsSection, SettingsListItem, getSettingsHeaderOptions } from '../../components/platform';
import { useSettings } from '../../hooks/context/useSettings';

const Settings = () => {
  const { navigate, setOptions } = useExtendedNavigation();
  const { language } = useSettings(); // Subscribe to language changes to trigger re-render
  const insets = useSafeAreaInsets();

  // Calculate header height for Android with transparent header
  // Standard Android header is 56dp + status bar height
  // For older Android versions, use a fallback if StatusBar.currentHeight is not available
  const headerHeight = useMemo(() => {
    if (Platform.OS === 'android') {
      const statusBarHeight = StatusBar.currentHeight ?? insets.top ?? 24; // Fallback to 24dp for older Android
      return 56 + statusBarHeight;
    }
    return 0;
  }, [insets.top]);

  useLayoutEffect(() => {
    setOptions(getSettingsHeaderOptions(loc.settings.header));
  }, [setOptions, language]); // Include language to trigger re-render when language changes

  const handleDonatePress = useCallback(() => {
    Linking.openURL('https://donate.bluewallet.io/');
  }, []);

  const localStyles = StyleSheet.create({
    donateIconContainer: {
      padding: 4,
    },
    donateIconImage: {
      width: 48,
      height: 48,
    },
  });

  const donateIcon = useMemo(
    () => (
      <View style={localStyles.donateIconContainer}>
        <Image source={require('../../img/bluebeast.png')} style={localStyles.donateIconImage} resizeMode="contain" />
      </View>
    ),
    [localStyles.donateIconContainer, localStyles.donateIconImage],
  );

  return (
    <SettingsScrollView testID="SettingsRoot" headerHeight={headerHeight}>
      <SettingsSection compact>
        <SettingsListItem
          title="Donate"
          subtitle="Help us keep Blue free!"
          leftIcon={donateIcon}
          onPress={handleDonatePress}
          testID="Donate"
          position="single"
        />
      </SettingsSection>

      <SettingsSection>
        <SettingsListItem
          title={loc.settings.general}
          iconName="settings"
          onPress={() => navigate('GeneralSettings')}
          testID="GeneralSettings"
          chevron
          position="first"
        />

        <SettingsListItem
          title={loc.settings.currency}
          iconName="currency"
          onPress={() => navigate('Currency')}
          testID="Currency"
          chevron
          position="middle"
        />

        <SettingsListItem
          title={loc.settings.language}
          iconName="language"
          onPress={() => navigate('Language')}
          testID="Language"
          chevron
          position="middle"
        />

        <SettingsListItem
          title={loc.settings.encrypt_title}
          iconName="security"
          onPress={() => navigate('EncryptStorage')}
          testID="SecurityButton"
          chevron
          position="middle"
        />

        <SettingsListItem
          title={loc.settings.network}
          iconName="network"
          onPress={() => navigate('NetworkSettings')}
          testID="NetworkSettings"
          chevron
          position="last"
        />
      </SettingsSection>

      <SettingsSection>
        <SettingsListItem
          title={loc.settings.tools}
          iconName="tools"
          onPress={() => navigate('SettingsTools')}
          testID="Tools"
          chevron
          position="single"
        />
      </SettingsSection>

      <SettingsSection>
        <SettingsListItem
          title={loc.settings.about}
          iconName="about"
          onPress={() => navigate('About')}
          testID="AboutButton"
          chevron
          position="single"
        />
      </SettingsSection>
    </SettingsScrollView>
  );
};

export default Settings;
