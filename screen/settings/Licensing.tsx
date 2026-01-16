import React, { useMemo } from 'react';
import { Platform, StatusBar } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlueSpacing20 } from '../../components/BlueSpacing';
import { SettingsScrollView, SettingsCard, SettingsText } from '../../components/platform';

const Licensing = () => {
  const insets = useSafeAreaInsets();

  // Calculate header height for Android with transparent header
  const headerHeight = useMemo(() => {
    if (Platform.OS === 'android' && insets.top > 0) {
      return 56 + (StatusBar.currentHeight || insets.top);
    }
    return 0;
  }, [insets.top]);

  return (
    <SettingsScrollView headerHeight={headerHeight}>
      <SettingsCard>
        <SettingsText>MIT License</SettingsText>
        <BlueSpacing20 />
        <SettingsText>Copyright (c) 2018-2024 BlueWallet developers</SettingsText>
        <BlueSpacing20 />
        <SettingsText>
          Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files
          (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify,
          merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is
          furnished to do so, subject to the following conditions:
        </SettingsText>
        <BlueSpacing20 />

        <SettingsText>
          The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
        </SettingsText>
        <BlueSpacing20 />

        <SettingsText>
          THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
          MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE
          LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN
          CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
        </SettingsText>
      </SettingsCard>
    </SettingsScrollView>
  );
};

export default Licensing;
