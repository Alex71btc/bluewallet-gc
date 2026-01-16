import React, { forwardRef } from 'react';
import { ScrollView, ScrollViewProps, ViewStyle } from 'react-native';
import SafeAreaScrollView from '../SafeAreaScrollView';

interface PlatformScrollViewProps extends Omit<ScrollViewProps, 'style' | 'contentContainerStyle'> {
  headerHeight?: number;
  additionalBottomPadding?: number;
  style?: ViewStyle;
  contentContainerStyle?: ViewStyle;
}

export const PlatformScrollView = forwardRef<ScrollView, PlatformScrollViewProps>((props, ref) => {
  const { style, contentContainerStyle, headerHeight = 0, additionalBottomPadding = 0, ...restProps } = props;

  return (
    <SafeAreaScrollView
      ref={ref}
      style={style}
      contentContainerStyle={contentContainerStyle}
      headerHeight={headerHeight}
      floatingButtonHeight={additionalBottomPadding}
      keyboardShouldPersistTaps="handled"
      {...restProps}
    />
  );
});

PlatformScrollView.displayName = 'PlatformScrollView';

export default PlatformScrollView;
