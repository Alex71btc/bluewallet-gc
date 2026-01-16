import React, { useCallback, useMemo } from 'react';
import { FlatListProps, StyleSheet, View, ViewStyle } from 'react-native';
import SafeAreaFlatList from '../SafeAreaFlatList';
import { platformColors, platformLayout, platformSizing, isAndroid } from './utils';

interface PlatformFlatListProps<ItemT> extends Omit<FlatListProps<ItemT>, 'style' | 'contentContainerStyle'> {
  headerHeight?: number;
  additionalBottomPadding?: number;
  style?: ViewStyle;
  contentContainerStyle?: ViewStyle;
}

function PlatformFlatListComponent<ItemT>(props: PlatformFlatListProps<ItemT>) {
  const { style, contentContainerStyle, headerHeight = 0, additionalBottomPadding = 0, ItemSeparatorComponent, ...restProps } = props;

  const computedContentContainerStyle = useMemo(() => {
    if (!isAndroid) return contentContainerStyle;

    return StyleSheet.flatten([
      {
        paddingLeft: 0,
        paddingRight: 0,
      },
      contentContainerStyle,
    ]);
  }, [contentContainerStyle]);

  const defaultItemSeparator = useCallback(() => {
    if (!platformLayout.useBorderBottom) return null;

    return <View style={[styles.separator, isAndroid && styles.separatorAndroid]} />;
  }, []);

  return (
    <SafeAreaFlatList
      style={style}
      contentContainerStyle={computedContentContainerStyle}
      headerHeight={headerHeight}
      floatingButtonHeight={additionalBottomPadding}
      contentInsetAdjustmentBehavior="automatic"
      automaticallyAdjustKeyboardInsets
      ItemSeparatorComponent={ItemSeparatorComponent !== undefined ? ItemSeparatorComponent : defaultItemSeparator}
      {...restProps}
    />
  );
}

export const PlatformFlatList = PlatformFlatListComponent as <ItemT>(props: PlatformFlatListProps<ItemT>) => React.ReactElement;

const styles = StyleSheet.create({
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: platformColors.separator,
  },
  separatorAndroid: {
    marginLeft: platformSizing.horizontalPadding,
  },
});

export default PlatformFlatList;
