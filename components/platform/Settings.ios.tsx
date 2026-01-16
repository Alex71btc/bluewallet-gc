import {
  SettingsCard,
  SettingsCardProps,
  SettingsFlatList,
  SettingsFlatListProps,
  SettingsIconName,
  SettingsListItemProps,
  SettingsScrollView,
  SettingsScrollViewProps,
  SettingsSection,
  SettingsSectionHeader,
  SettingsSectionHeaderProps,
  SettingsSectionProps,
  SettingsSubtitle,
  SettingsText,
  createSettingsListItem,
  getSettingsHeaderOptions,
  getSettingsIconColor,
} from './Settings.shared';
import PlatformListItem from '../PlatformListItem';

const iconNameMap: Record<SettingsIconName, string> = {
  settings: 'settings-outline',
  currency: 'cash-outline',
  language: 'language-outline',
  security: 'shield-checkmark-outline',
  network: 'globe-outline',
  tools: 'construct-outline',
  about: 'information-circle-outline',
  privacy: 'lock-closed-outline',
  notifications: 'notifications-outline',
  lightning: 'flash-outline',
  blockExplorer: 'search-outline',
  defaultView: 'list-outline',
  electrum: 'server-outline',
  licensing: 'shield-checkmark-outline',
  releaseNotes: 'document-text-outline',
  selfTest: 'flask-outline',
  performance: 'speedometer-outline',
  github: 'logo-github',
  x: 'logo-twitter',
  twitter: 'logo-twitter',
  telegram: 'paper-plane-outline',
  search: 'search-outline',
  paperPlane: 'paper-plane-outline',
  key: 'key-outline',
};

const iconBackgroundMap: Partial<Record<SettingsIconName, string>> = {
  settings: 'rgba(142, 142, 147, 0.12)',
  currency: 'rgba(52, 199, 89, 0.12)',
  language: 'rgba(255, 149, 0, 0.12)',
  security: 'rgba(255, 59, 48, 0.12)',
  network: 'rgba(0, 122, 255, 0.12)',
  lightning: 'rgba(255, 149, 0, 0.12)',
  tools: 'rgba(142, 142, 147, 0.12)',
  about: 'rgba(142, 142, 147, 0.12)',
  privacy: 'rgba(142, 142, 147, 0.12)',
};

const getIconProps = (name: SettingsIconName): PlatformListItemProps['leftIcon'] => {
  return {
    name: iconNameMap[name] ?? 'settings-outline',
    type: 'ionicon',
    color: getSettingsIconColor(name),
    backgroundColor: iconBackgroundMap[name],
  };
};
type PlatformListItemProps = React.ComponentProps<typeof PlatformListItem>;

export const SettingsListItem = createSettingsListItem(getIconProps);

export {
  SettingsCard,
  SettingsCardProps,
  SettingsFlatList,
  SettingsFlatListProps,
  SettingsIconName,
  SettingsListItemProps,
  SettingsScrollView,
  SettingsScrollViewProps,
  SettingsSection,
  SettingsSectionHeader,
  SettingsSectionHeaderProps,
  SettingsSectionProps,
  SettingsSubtitle,
  SettingsText,
  getSettingsHeaderOptions,
};
