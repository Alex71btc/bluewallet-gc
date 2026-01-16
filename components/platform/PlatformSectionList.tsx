import React, { useCallback, useMemo } from 'react';
import { SectionListProps, StyleSheet, View, ViewStyle, DefaultSectionT, SectionListData, Text } from 'react-native';
import PropTypes from 'prop-types';
import { platformColors, platformSizing, platformLayout, isAndroid } from './utils';
import SafeAreaSectionList from '../SafeAreaSectionList';

type SectionWithTitle<ItemT, SectionT = DefaultSectionT> = SectionListData<ItemT, SectionT> & {
  title?: string | React.ReactNode;
};

interface PlatformSectionListProps<ItemT, SectionT = DefaultSectionT>
  extends Omit<SectionListProps<ItemT, SectionT>, 'contentContainerStyle' | 'style' | 'sections'> {
  headerHeight?: number;
  additionalContentPadding?: number;
  style?: ViewStyle;
  contentContainerStyle?: ViewStyle;
  sections: ReadonlyArray<SectionWithTitle<ItemT, SectionT>>;
}

function PlatformSectionListComponent<ItemT, SectionT = DefaultSectionT>(props: PlatformSectionListProps<ItemT, SectionT>) {
  const {
    headerHeight = 0,
    additionalContentPadding = 0,
    style,
    contentContainerStyle,
    renderSectionHeader,
    ItemSeparatorComponent,
    SectionSeparatorComponent,
    stickySectionHeadersEnabled = !isAndroid,
    ...restProps
  } = props;

  const computedStyle = useMemo(() => {
    return StyleSheet.flatten([
      {
        flex: 1,
        backgroundColor: platformColors.background,
      },
      style,
    ]);
  }, [style]);

  const defaultSectionHeaderRenderer = useCallback(({ section }: { section: SectionWithTitle<ItemT, SectionT> }) => {
    if (!section.title) return null;

    return (
      <View style={[styles.sectionHeader, isAndroid && styles.sectionHeaderAndroid, !isAndroid && styles.sectionHeaderIOS]}>
        {typeof section.title === 'string' ? <Text style={styles.sectionHeaderText}>{section.title}</Text> : section.title}
      </View>
    );
  }, []);

  const defaultItemSeparator = useCallback(() => {
    if (!platformLayout.useBorderBottom) return null;

    return <View style={[styles.separator, isAndroid && styles.separatorAndroid]} />;
  }, []);

  return (
    <SafeAreaSectionList
      style={computedStyle}
      contentContainerStyle={contentContainerStyle}
      headerHeight={headerHeight}
      floatingButtonHeight={additionalContentPadding}
      contentInsetAdjustmentBehavior="automatic"
      automaticallyAdjustKeyboardInsets
      stickySectionHeadersEnabled={stickySectionHeadersEnabled}
      renderSectionHeader={
        (renderSectionHeader || defaultSectionHeaderRenderer) as SectionListProps<ItemT, SectionT>['renderSectionHeader']
      }
      ItemSeparatorComponent={ItemSeparatorComponent !== undefined ? ItemSeparatorComponent : defaultItemSeparator}
      SectionSeparatorComponent={SectionSeparatorComponent}
      {...restProps}
    />
  );
}

export const PlatformSectionList = PlatformSectionListComponent as <ItemT, SectionT = DefaultSectionT>(
  props: PlatformSectionListProps<ItemT, SectionT>,
) => React.ReactElement;

PlatformSectionListComponent.propTypes = {
  renderSectionHeader: PropTypes.func,
  ItemSeparatorComponent: PropTypes.oneOfType([PropTypes.func, PropTypes.elementType]),
  SectionSeparatorComponent: PropTypes.oneOfType([PropTypes.func, PropTypes.elementType]),
  stickySectionHeadersEnabled: PropTypes.bool,
};

const styles = StyleSheet.create({
  sectionHeader: {
    paddingVertical: 8,
  },
  sectionHeaderIOS: {
    paddingHorizontal: platformSizing.horizontalPadding,
    paddingTop: platformSizing.sectionSpacing,
    paddingBottom: 8,
  },
  sectionHeaderAndroid: {
    paddingHorizontal: platformSizing.horizontalPadding,
    paddingTop: 24,
    paddingBottom: 8,
  },
  sectionHeaderText: {
    color: platformColors.secondaryText,
    fontSize: platformSizing.subtitleFontSize,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: platformColors.separator,
  },
  separatorAndroid: {
    marginLeft: platformSizing.horizontalPadding,
  },
});

export default PlatformSectionList;
