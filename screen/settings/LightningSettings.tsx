import React, { useCallback, useEffect, useState, useMemo } from 'react';
import { RouteProp, useRoute } from '@react-navigation/native';
import { Alert, Linking, StyleSheet, View, Platform, StatusBar } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import DefaultPreference from 'react-native-default-preference';
import { BlueLoading } from '../../components/BlueLoading';
import DeeplinkSchemaMatch from '../../class/deeplink-schema-match';
import { LightningCustodianWallet } from '../../class/wallets/lightning-custodian-wallet';
import presentAlert, { AlertType } from '../../components/Alert';
import { Button } from '../../components/Button';
import loc from '../../loc';
import triggerHapticFeedback, { HapticFeedbackTypes } from '../../blue_modules/hapticFeedback';
import { GROUP_IO_BLUEWALLET } from '../../blue_modules/currency';
import { clearLNDHub, getLNDHub, setLNDHub } from '../../helpers/lndHub';
import { DetailViewStackParamList } from '../../navigation/DetailViewStackParamList';
import { useExtendedNavigation } from '../../hooks/useExtendedNavigation';
import AddressInput from '../../components/AddressInput';
import { SettingsScrollView, SettingsCard, SettingsListItem, SettingsSubtitle } from '../../components/platform';

type LightingSettingsRouteProps = RouteProp<DetailViewStackParamList, 'LightningSettings'>;

const LightningSettings: React.FC = () => {
  const params = useRoute<LightingSettingsRouteProps>().params;
  const [isLoading, setIsLoading] = useState(true);
  const [URI, setURI] = useState<string>();
  const { setParams } = useExtendedNavigation();
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

  const styles = StyleSheet.create({
    inputContainer: {
      marginTop: 16,
      marginBottom: 16,
    },
    buttonContainer: {
      marginTop: 16,
    },
    githubContainer: {
      marginTop: 16,
    },
    addressInput: {
      minHeight: 44,
      height: 'auto',
    },
  });

  useEffect(() => {
    const fetchURI = async () => {
      try {
        const value = await getLNDHub();
        setURI(value ?? undefined);
      } catch (error) {
        console.log(error);
      }
    };

    const initialize = async () => {
      setIsLoading(true);
      await fetchURI().finally(() => {
        setIsLoading(false);
        if (params?.url) {
          Alert.alert(
            loc.formatString(loc.settings.set_lndhub_as_default, { url: params.url }) as string,
            '',
            [
              {
                text: loc._.ok,
                onPress: () => {
                  params?.url && setLndhubURI(params.url);
                },
                style: 'default',
              },
              { text: loc._.cancel, onPress: () => {}, style: 'cancel' },
            ],
            { cancelable: false },
          );
        }
      });
    };

    initialize();
  }, [params?.url]);

  const setLndhubURI = (value: string) => {
    const setLndHubUrl = DeeplinkSchemaMatch.getUrlFromSetLndhubUrlAction(value);
    setURI(typeof setLndHubUrl === 'string' ? setLndHubUrl.trim() : value.trim());
  };

  const save = useCallback(async () => {
    setIsLoading(true);
    let normalizedURI;
    try {
      await DefaultPreference.setName(GROUP_IO_BLUEWALLET);
      if (URI) {
        normalizedURI = new URL(URI.replace(/([^:]\/)\/+/g, '$1')).toString();
        await LightningCustodianWallet.isValidNodeAddress(normalizedURI);
        await setLNDHub(normalizedURI);
      } else {
        await clearLNDHub();
      }

      presentAlert({ message: loc.settings.lightning_saved, type: AlertType.Toast });
      triggerHapticFeedback(HapticFeedbackTypes.NotificationSuccess);
    } catch (error) {
      triggerHapticFeedback(HapticFeedbackTypes.NotificationError);
      presentAlert({
        message: normalizedURI?.endsWith('.onion') ? loc.settings.lightning_error_lndhub_uri_tor : loc.settings.lightning_error_lndhub_uri,
      });
      console.log(error);
    }
    setIsLoading(false);
  }, [URI]);

  useEffect(() => {
    const data = params?.onBarScanned;
    if (data) {
      setLndhubURI(data);
      setParams({ onBarScanned: undefined });
    }
  }, [params?.onBarScanned, setParams]);

  const handleOpenGithub = () => {
    Linking.openURL('https://github.com/BlueWallet/LndHub');
  };

  return (
    <SettingsScrollView automaticallyAdjustContentInsets contentInsetAdjustmentBehavior="automatic" headerHeight={headerHeight}>
      <SettingsCard>
        <SettingsSubtitle>{loc.settings.lightning_settings_explain}</SettingsSubtitle>

        <View style={styles.githubContainer}>
          <SettingsListItem
            title="GitHub Repository"
            subtitle="github.com/BlueWallet/LndHub"
            onPress={handleOpenGithub}
            iconName="github"
            position="single"
          />
        </View>
      </SettingsCard>

      <SettingsCard>
        <View style={styles.inputContainer}>
          <AddressInput
            isLoading={isLoading}
            address={URI}
            placeholder={loc.formatString(loc.settings.lndhub_uri, { example: 'https://10.20.30.40:3000' })}
            onChangeText={setLndhubURI}
            testID="URIInput"
            editable={!isLoading}
            style={styles.addressInput}
          />
        </View>

        <View style={styles.buttonContainer}>
          {isLoading ? <BlueLoading /> : <Button testID="Save" onPress={save} title={loc.settings.save} />}
        </View>
      </SettingsCard>
    </SettingsScrollView>
  );
};

export default LightningSettings;
