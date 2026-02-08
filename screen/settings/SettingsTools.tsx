import React from 'react';
import ListItem from '../../components/ListItem';
import { useExtendedNavigation } from '../../hooks/useExtendedNavigation';
import loc from '../../loc';
import SafeAreaScrollView from '../../components/SafeAreaScrollView';

const SettingsTools: React.FC = () => {
  const { navigate } = useExtendedNavigation();

  return (
    <SafeAreaScrollView>
      <ListItem title={loc.is_it_my_address.title} onPress={() => navigate('IsItMyAddress')} testID="IsItMyAddress" chevron />
      <ListItem title={loc.settings.network_broadcast} onPress={() => navigate('Broadcast')} testID="Broadcast" chevron />
      <ListItem title={loc.autofill_word.title} onPress={() => navigate('GenerateWord')} testID="GenerateWord" chevron />
    </SafeAreaScrollView>
  );
};

export default SettingsTools;
