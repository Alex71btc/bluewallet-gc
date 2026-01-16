import React, { useCallback, useMemo } from 'react';
import { FlatList, FlatListProps, StyleSheet, View, ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { platformColors, platformLayout, platformSizing, isAndroid } from './utils';

interface PlatformFlatListProps<ItemT> extends Omit<FlatListProps<ItemT>, 'style' | 'contentContainerStyle'> {
  headerHeight?: number;
  additionalBottomPadding?: number;
  style?: ViewStyle;
  contentContainerStyle?: ViewStyle;
}

function PlatformFlatListComponent<ItemT>(props: PlatformFlatListProps<ItemT>) {
  const { style, contentContainerStyle, headerHeight = 0, additionalBottomPadding = 0, ItemSeparatorComponent, ...restProps } = props;

  const insets = useSafeAreaInsets();

  const computedStyle = useMemo(() => {
    return StyleSheet.flatten([
      {
        flex: 1,
        backgroundColor: platformColors.background,
      },
      style,
    ]);
  }, [style]);

  const computedContentContainerStyle = useMemo(() => {
    const topPadding = headerHeight > 0 ? headerHeight : 0;

    return StyleSheet.flatten([
      {
        paddingTop: topPadding,
        paddingBottom: insets.bottom + additionalBottomPadding,
        paddingLeft: isAndroid ? 0 : insets.left,
        paddingRight: isAndroid ? 0 : insets.right,
      },
      contentContainerStyle,
    ]);
  }, [insets, headerHeight, additionalBottomPadding, contentContainerStyle]);

  const defaultItemSeparator = useCallback(() => {
    if (!platformLayout.useBorderBottom) return null;

    return <View style={[styles.separator, isAndroid && styles.separatorAndroid]} />;
  }, []);

  return (
    <FlatList
      style={computedStyle}
      contentContainerStyle={computedContentContainerStyle}
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
