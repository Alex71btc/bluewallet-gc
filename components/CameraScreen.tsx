import { Icon } from '@rneui/base';
import React, { useRef, useState } from 'react';
import { Animated, Platform, StyleSheet, TouchableOpacity, View } from 'react-native';
// neu (wie v7.2.3)
import { Camera, CameraApi, CameraType, Orientation } from 'react-native-camera-kit';
// plus diese Types:
import { OnOrientationChangeData, OnReadCodeData } from 'react-native-camera-kit/dist/CameraProps';
import { isDesktop } from '../blue_modules/environment';
import { triggerSelectionHapticFeedback } from '../blue_modules/hapticFeedback';
import loc from '../loc';

interface CameraScreenProps {
  onCancelButtonPress: () => void;
  showImagePickerButton?: boolean;
  showFilePickerButton?: boolean;
  onImagePickerButtonPress?: () => void;
  onFilePickerButtonPress?: () => void;
  onReadCode?: (event: OnReadCodeData) => void;
  // Preview ready hook for perf instrumentation
  onPreviewReady?: () => void;
  // Animated-mode knobs
  animatedMode?: boolean;
  resetFocusWhenMotionDetected?: boolean;
  scanThrottleDelayMs?: number;
}

const CameraScreen: React.FC<CameraScreenProps> = ({
  onCancelButtonPress,
  showImagePickerButton,
  showFilePickerButton,
  onImagePickerButtonPress,
  onFilePickerButtonPress,
  onReadCode,
  onPreviewReady,
  animatedMode = false,
  resetFocusWhenMotionDetected,
  scanThrottleDelayMs,
}) => {
  const cameraRef = useRef<CameraApi>(null);
  const [torchMode, setTorchMode] = useState(false);
  const [cameraType, setCameraType] = useState(CameraType.Back);
  const [zoom, setZoom] = useState<number | undefined>();
  const [orientationAnim] = useState(new Animated.Value(3));
  const previewDidFireRef = useRef(false);

  const onSwitchCameraPressed = () => {
    const direction = cameraType === CameraType.Back ? CameraType.Front : CameraType.Back;
    setCameraType(direction);
    setZoom(1); // When changing camera type, reset to default zoom for that camera
    triggerSelectionHapticFeedback();
  };

  const onSetTorch = () => {
    setTorchMode(!torchMode);
    triggerSelectionHapticFeedback();
  };

  // Counter-rotate the icons to indicate the actual orientation of the captured photo.
  const rotateUi = true;
  const uiRotation = orientationAnim.interpolate({
    inputRange: [1, 2, 3, 4],
    outputRange: ['180deg', '90deg', '0deg', '-90deg'],
  });
  const uiRotationStyle = rotateUi ? { transform: [{ rotate: uiRotation }] } : {};

  function rotateUiTo(rotationValue: number) {
    Animated.timing(orientationAnim, {
      toValue: rotationValue,
      useNativeDriver: true,
      duration: 200,
      isInteraction: false,
    }).start();
  }

  const handleZoom = (e: { nativeEvent: { zoom: number } }) => {
    console.debug('zoom', e.nativeEvent.zoom);
    setZoom(e.nativeEvent.zoom);
  };

  const handleOrientationChange = (e: OnOrientationChangeData) => {
    switch (e.nativeEvent.orientation) {
      case Orientation.PORTRAIT_UPSIDE_DOWN:
        console.debug('orientationChange', 'PORTRAIT_UPSIDE_DOWN');
        rotateUiTo(1);
        break;
      case Orientation.LANDSCAPE_LEFT:
        console.debug('orientationChange', 'LANDSCAPE_LEFT');
        rotateUiTo(2);
        break;
      case Orientation.PORTRAIT:
        console.debug('orientationChange', 'PORTRAIT');
        rotateUiTo(3);
        break;
      case Orientation.LANDSCAPE_RIGHT:
        console.debug('orientationChange', 'LANDSCAPE_RIGHT');
        rotateUiTo(4);
        break;
      default:
        console.debug('orientationChange', e.nativeEvent);
        break;
    }
  };

  const handleReadCode = (event: OnReadCodeData) => {
    onReadCode?.(event);
  };

  return (
    <View style={styles.screen}>
      {!isDesktop && (
        <View style={styles.topButtons}>
          <TouchableOpacity style={[styles.topButton, uiRotationStyle, torchMode ? styles.activeTorch : {}]} onPress={onSetTorch}>
            <Animated.View style={styles.topButtonImg}>
              {Platform.OS === 'ios' ? (
                <Icon name={torchMode ? 'flashlight-on' : 'flashlight-off'} type="font-awesome-6" color={torchMode ? '#000' : '#fff'} />
              ) : (
                <Icon name={torchMode ? 'flash-on' : 'flash-off'} type="ionicons" color={torchMode ? '#000' : '#fff'} />
              )}
            </Animated.View>
          </TouchableOpacity>

          <View style={styles.rightButtonsContainer}>
            {showImagePickerButton && (
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel={loc._.pick_image}
                style={[styles.topButton, styles.spacing, uiRotationStyle]}
                onPress={onImagePickerButtonPress}
              >
                <Animated.View style={styles.topButtonImg}>
                  <Icon name="image" type="font-awesome" color="#ffffff" />
                </Animated.View>
              </TouchableOpacity>
            )}
            {showFilePickerButton && (
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel={loc._.pick_file}
                style={[styles.topButton, styles.spacing, uiRotationStyle]}
                onPress={onFilePickerButtonPress}
              >
                <Animated.View style={styles.topButtonImg}>
                  <Icon name="file-import" type="font-awesome-5" color="#ffffff" />
                </Animated.View>
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}

      <View style={styles.cameraContainer}>
        <Camera
          ref={cameraRef}
          style={styles.cameraPreview}
          cameraType={cameraType}
          scanBarcode
          resizeMode="cover"
          onReadCode={handleReadCode}
          torchMode={torchMode ? 'on' : 'off'}

          // resetFocusWhenMotionDetected: allow prop override, but enable for animatedMode to reduce repeated identical reads
          resetFocusWhenMotionDetected={
            animatedMode ? true : (resetFocusWhenMotionDetected ?? false)
          }

          // scanThrottleDelay: allow prop; if animatedMode and no explicit prop, use higher default (80ms) to reduce duplicates
          // @ts-ignore
          scanThrottleDelay={animatedMode ? (typeof scanThrottleDelayMs === 'number' ? scanThrottleDelayMs : 200) : (scanThrottleDelayMs ?? 0)}  // ms

          // ROI / scan area for animated mode (if supported by camera lib)
          // Use guarded @ts-ignore to avoid TS errors if props don't exist
          // center area: width 50% height 35%
          // @ts-ignore
          scanAreaX={animatedMode ? 0.25 : undefined}
          // @ts-ignore
          scanAreaY={animatedMode ? 0.325 : undefined}
          // @ts-ignore
          scanAreaWidth={animatedMode ? 0.5 : undefined}
          // @ts-ignore
          scanAreaHeight={animatedMode ? 0.35 : undefined}

          // ROI / scan area for animated mode (if supported by camera lib)
          // Use guarded @ts-ignore to avoid TS errors if props don't exist
          // center area: width 60% height 35%
          // @ts-ignore
          scanAreaX={animatedMode ? 0.2 : undefined}
          // @ts-ignore
          scanAreaY={animatedMode ? 0.325 : undefined}
          // @ts-ignore
          scanAreaWidth={animatedMode ? 0.6 : undefined}
          // @ts-ignore
          scanAreaHeight={animatedMode ? 0.35 : undefined}
          // optionally show a frame in debug builds
          // @ts-ignore
          showFrame={animatedMode ? false : undefined}
          
          // stabilization / focus / exposure hints (guarded)
          // @ts-ignore
          continuousFocus={animatedMode ? true : undefined}
          // @ts-ignore
          autoExposure={animatedMode ? 'on' : undefined}
          // @ts-ignore
          autoFocus={animatedMode ? 'on' : undefined}
          // @ts-ignore
          whiteBalance={animatedMode ? 'auto' : undefined}

          // notify when preview/camera is initialized and preview frames start
          // some Camera lib variants expose onInitialized / onCameraReady
          // we call through to parent via onPreviewReady, but ensure it's only fired once
          // @ts-ignore
          onInitialized={() => {
            try {
              if (!previewDidFireRef.current) {
                previewDidFireRef.current = true;
                if (typeof onPreviewReady === 'function') onPreviewReady();
              }
            } catch (e) {
              // ignore
            }
          }}
          // Fallback: some builds don't fire onInitialized. Use onLayout of camera container.
          onLayout={() => {
            try {
              if (!previewDidFireRef.current) {
                previewDidFireRef.current = true;
                if (typeof onPreviewReady === 'function') onPreviewReady();
              }
            } catch (e) {}
          }}

          zoom={zoom}
          onZoom={handleZoom}
          maxZoom={10}
          onOrientationChange={handleOrientationChange}
        />
      </View>

      <View style={styles.bottomButtons}>
        <TouchableOpacity onPress={onCancelButtonPress}>
          <Animated.Text style={[styles.backTextStyle, uiRotationStyle]}>{loc._.cancel}</Animated.Text>
        </TouchableOpacity>

        {isDesktop ? (
          <View style={styles.rightButtonsContainer}>
            {showImagePickerButton && (
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel={loc._.pick_image}
                style={[styles.bottomButton, styles.spacing, uiRotationStyle]}
                onPress={onImagePickerButtonPress}
              >
                <Animated.View style={styles.topButtonImg}>
                  <Icon name="image" type="font-awesome" color="#ffffff" />
                </Animated.View>
              </TouchableOpacity>
            )}
            {showFilePickerButton && (
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel={loc._.pick_file}
                style={[styles.bottomButton, styles.spacing, uiRotationStyle]}
                onPress={onFilePickerButtonPress}
              >
                <Animated.View style={styles.topButtonImg}>
                  <Icon name="file-import" type="font-awesome-5" color="#ffffff" />
                </Animated.View>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          <TouchableOpacity style={[styles.bottomButton, uiRotationStyle]} onPress={onSwitchCameraPressed}>
            <Animated.View style={[styles.topButtonImg, uiRotationStyle]}>
              {Platform.OS === 'ios' ? (
                <Icon name="cameraswitch" type="font-awesome-6" color="#ffffff" />
              ) : (
                <Icon name={cameraType === CameraType.Back ? 'camera-rear' : 'camera-front'} type="ionicons" color="#ffffff" />
              )}
            </Animated.View>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

export default CameraScreen;

const styles = StyleSheet.create({
  activeTorch: {
    backgroundColor: '#fff',
  },
  screen: {
    height: '100%',
    backgroundColor: '#000000',
  },
  topButtons: {
    padding: 10,
    zIndex: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  topButton: {
    backgroundColor: '#222',
    borderRadius: 30,
    padding: 10,
  },
  topButtonImg: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  rightButtonsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  spacing: {
    marginLeft: 10,
  },
  cameraContainer: {
    flex: 1,
  },
  cameraPreview: {
    flex: 1,
  },
  bottomButtons: {
    padding: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  bottomButton: {
    backgroundColor: '#222',
    borderRadius: 30,
    padding: 10,
  },
  backTextStyle: {
    color: '#fff',
    fontSize: 18,
    padding: 10,
  },
});
