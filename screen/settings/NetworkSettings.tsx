import React, { useMemo } from 'react';
import { Platform, StatusBar } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useExtendedNavigation } from '../../hooks/useExtendedNavigation';
import loc from '../../loc';
import { SettingsScrollView, SettingsSection, SettingsListItem } from '../../components/platform';

const NetworkSettings: React.FC = () => {
  const navigation = useExtendedNavigation();
  const isNotificationsCapable = Platform.OS !== 'web';
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

  const navigateToElectrumSettings = () => {
    navigation.navigate('ElectrumSettings');
  };

  const navigateToLightningSettings = () => {
    navigation.navigate('LightningSettings');
  };

  const navigateToBlockExplorerSettings = () => {
    navigation.navigate('SettingsBlockExplorer');
  };

  const navigateToNotificationSettings = () => {
    navigation.navigate('NotificationSettings');
  };

  return (
    <SettingsScrollView headerHeight={headerHeight}>
      <SettingsSection>
        <SettingsListItem
          title={loc.settings.block_explorer}
          iconName="blockExplorer"
          onPress={navigateToBlockExplorerSettings}
          testID="BlockExplorerSettings"
          chevron
          position="first"
        />

        <SettingsListItem
          title={loc.settings.network_electrum}
          iconName="electrum"
          onPress={navigateToElectrumSettings}
          testID="ElectrumSettings"
          chevron
          position="middle"
        />

        <SettingsListItem
          title={loc.settings.lightning_settings}
          iconName="lightning"
          onPress={navigateToLightningSettings}
          testID="LightningSettings"
          chevron
          position={isNotificationsCapable ? 'middle' : 'last'}
        />

        {isNotificationsCapable && (
          <SettingsListItem
            title={loc.settings.notifications}
            iconName="notifications"
            onPress={navigateToNotificationSettings}
            testID="NotificationSettings"
            chevron
            position="last"
          />
        )}
      </SettingsSection>
    </SettingsScrollView>
  );
};

export default NetworkSettings;
