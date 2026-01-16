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
  settings: 'settings',
  currency: 'attach-money',
  language: 'language',
  security: 'security',
  network: 'public',
  tools: 'build',
  about: 'info',
  privacy: 'lock',
  notifications: 'notifications',
  lightning: 'bolt',
  blockExplorer: 'travel-explore',
  defaultView: 'view-list',
  electrum: 'storage',
  licensing: 'verified-user',
  releaseNotes: 'description',
  selfTest: 'science',
  performance: 'speed',
  github: 'code',
  x: 'chat',
  twitter: 'chat',
  telegram: 'send',
  search: 'search',
  paperPlane: 'send',
  key: 'vpn-key',
};

const getIconProps = (name: SettingsIconName): PlatformListItemProps['leftIcon'] => {
  return {
    name: iconNameMap[name] ?? 'cog',
    type: 'material',
    color: getSettingsIconColor(name),
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
