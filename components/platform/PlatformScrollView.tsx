import React, { forwardRef, useMemo } from 'react';
import { ScrollView, ScrollViewProps, StyleSheet, ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { platformColors } from './utils';

interface PlatformScrollViewProps extends Omit<ScrollViewProps, 'style' | 'contentContainerStyle'> {
  headerHeight?: number;
  additionalBottomPadding?: number;
  style?: ViewStyle;
  contentContainerStyle?: ViewStyle;
}

export const PlatformScrollView = forwardRef<ScrollView, PlatformScrollViewProps>((props, ref) => {
  const { style, contentContainerStyle, headerHeight = 0, additionalBottomPadding = 0, ...restProps } = props;

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
    const topPadding = headerHeight > 0 ? headerHeight : insets.top > 0 ? 5 : 0;

    const basePadding: ViewStyle = {
      paddingTop: topPadding,
      paddingBottom: insets.bottom + additionalBottomPadding,
    };

    const flattenedStyle = StyleSheet.flatten(contentContainerStyle);
    if (!flattenedStyle?.paddingHorizontal && !flattenedStyle?.paddingLeft) {
      basePadding.paddingLeft = insets.left;
    }
    if (!flattenedStyle?.paddingHorizontal && !flattenedStyle?.paddingRight) {
      basePadding.paddingRight = insets.right;
    }

    return StyleSheet.flatten([basePadding, contentContainerStyle]);
  }, [insets, headerHeight, additionalBottomPadding, contentContainerStyle]);

  return (
    <ScrollView
      ref={ref}
      style={computedStyle}
      contentContainerStyle={computedContentContainerStyle}
      contentInsetAdjustmentBehavior="automatic"
      automaticallyAdjustKeyboardInsets
      automaticallyAdjustsScrollIndicatorInsets
      keyboardShouldPersistTaps="handled"
      {...restProps}
    />
  );
});

PlatformScrollView.displayName = 'PlatformScrollView';

export default PlatformScrollView;
