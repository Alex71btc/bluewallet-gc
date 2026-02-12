import { RouteProp, StackActions, useIsFocused, useRoute } from '@react-navigation/native';
import * as bitcoin from 'bitcoinjs-lib';
import { sha256 } from '@noble/hashes/sha256';
import React, { useEffect, useRef, useState } from 'react';
import { Platform, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';
import Base43 from '../../blue_modules/base43';
import * as fs from '../../blue_modules/fs';
import { BlueURDecoder, decodeUR, extractSingleWorkload } from '../../blue_modules/ur';
import { BlueText } from '../../BlueComponents';
import { openPrivacyDesktopSettings } from '../../class/camera';
import Button from '../../components/Button';
import { useTheme } from '../../components/themes';
import { isCameraAuthorizationStatusGranted } from '../../helpers/scan-qr';
import loc from '../../loc';
import { useExtendedNavigation } from '../../hooks/useExtendedNavigation';
import CameraScreen from '../../components/CameraScreen';
import SafeArea from '../../components/SafeArea';
import { SendDetailsStackParamList } from '../../navigation/SendDetailsStackParamList.ts';
import { BlueSpacing40 } from '../../components/BlueSpacing';
import { BlueLoading } from '../../components/BlueLoading.tsx';
import { hexToUint8Array, uint8ArrayToBase64, uint8ArrayToHex, uint8ArrayToString } from '../../blue_modules/uint8array-extras/index.js';

let decoder: BlueURDecoder | undefined;

type RouteProps = RouteProp<SendDetailsStackParamList, 'ScanQRCode'>;

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#000000',
  },
  openSettingsContainer: {
    justifyContent: 'center',
    alignContent: 'center',
    alignItems: 'center',
    height: '100%',
  },
  backdoorButton: {
    width: 60,
    height: 60,
    backgroundColor: 'rgba(0,0,0,0.01)',
    position: 'absolute',
    top: 60,
    left: '50%',
    transform: [{ translateX: -30 }],
  },
  backdoorInputWrapper: { position: 'absolute', left: '5%', top: '0%', width: '90%', height: '70%', backgroundColor: 'white' },
  progressWrapper: { position: 'absolute', alignSelf: 'center', alignItems: 'center', top: '50%', padding: 8, borderRadius: 8 },
  backdoorInput: {
    height: '50%',
    marginTop: 5,
    marginHorizontal: 20,
    borderWidth: 1,
    borderRadius: 4,
    textAlignVertical: 'top',
  },
});

const ScanQRCode = () => {
  const [isLoading, setIsLoading] = useState(false);
  const navigation = useExtendedNavigation();
  const route = useRoute<RouteProps>();
  const navigationState = navigation.getState();
  const previousRoute = navigationState.routes[navigationState.routes.length - 2];
  const defaultLaunchedBy = previousRoute ? previousRoute.name : undefined;

  const { launchedBy = defaultLaunchedBy, showFileImportButton, onBarScanned } = route.params || {};
  const scannedCacheRef = useRef<Record<string, number>>({});
  const { colors } = useTheme();
  const isFocused = useIsFocused();
  const [backdoorPressed, setBackdoorPressed] = useState(0);
  const [urTotal, setUrTotal] = useState(0);
  const [urHave, setUrHave] = useState(0);
  const [backdoorText, setBackdoorText] = useState('');
  const [backdoorVisible, setBackdoorVisible] = useState(false);
  const useBBQRRef = useRef(false);
  const [animatedMode, setAnimatedMode] = useState(false);
  const [animatedQRCodeData, setAnimatedQRCodeData] = useState<Record<string, string>>({});
  const [cameraStatusGranted, setCameraStatusGranted] = useState<boolean | undefined>(undefined);
  const stylesHook = StyleSheet.create({
    openSettingsContainer: {
      backgroundColor: colors.brandingColor,
    },
    progressWrapper: { backgroundColor: colors.brandingColor, borderColor: colors.foregroundColor, borderWidth: 4 },
    backdoorInput: {
      borderColor: colors.formBorder,
      borderBottomColor: colors.formBorder,
      backgroundColor: colors.inputBackgroundColor,
      color: colors.foregroundColor,
    },
  });

  // Performance instrumentation
  const perfRef = useRef({
    t0: Date.now(),
    previewReady: 0,
    firstAttemptAt: 0,
    firstSuccessAt: 0,
    attempts: 0,
    lastFlush: Date.now(),
  });
  const lockedRef = useRef(false);

  // Patch B: Backpressure + dedupe + UI batching for animated UR/BBQR
  const pendingPartsQueueRef = useRef<string[]>([]);
  const processingRef = useRef(false);
  const dedupeMapRef = useRef<Map<string, number>>(new Map());
  const peakQueueRef = useRef(0);
  const lastProgressUpdateRef = useRef(0);
  const partsProcessedRef = useRef(0);
  const PROGRESS_THROTTLE_MS = 200; // default
  const QUEUE_CAP = 20;
  const DEDUPE_TTL_MS = 2000;

  // additional drop counters
  const droppedSameStreakCountRef = useRef(0);
  const droppedDuplicateWindowCountRef = useRef(0);

  // Use full raw string as dedupe key for UR/BBQR to avoid collisions
  const makeDedupeKey = (s: string) => s;

  const cleanupDedupeIfNeeded = () => {
    const map = dedupeMapRef.current;
    if (map.size > 200) {
      const now = Date.now();
      for (const [k, ts] of map.entries()) {
        if (now - ts > DEDUPE_TTL_MS) map.delete(k);
      }
    }
  };

  // Throttle sweep (debug) - test different camera throttle values
  const DEBUG_THROTTLE_SWEEP = false; // set true to auto-pick from array for testing
  const THROTTLE_SWEEP_VALUES = [0, 15, 30, 50, 80];
  const selectThrottleForSession = () => {
    if (!DEBUG_THROTTLE_SWEEP) return undefined;
    const idx = Math.floor(Date.now() / 1000) % THROTTLE_SWEEP_VALUES.length;
    return THROTTLE_SWEEP_VALUES[idx];
  };
  const sessionThrottleOverride = selectThrottleForSession();

  // per-second accepted/unique counters
  const acceptedThisSecondRef = useRef(0);
  const uniqueThisSecondRef = useRef(0);
  const lastSecondRef = useRef(Math.floor(Date.now() / 1000));

  // Debugging gate (temporary flag)
  const DEBUG_ANIMATED = false; // set true when you want verbose animated fragment logs
  const debugCountRef = useRef(0);
  const DEBUG_MAX = 30; // log first N events for inspection


  const throttledSetProgress = (have: number, total: number) => {
    const now = Date.now();
    if (now - lastProgressUpdateRef.current > PROGRESS_THROTTLE_MS) {
      lastProgressUpdateRef.current = now;
      setUrTotal(total);
      setUrHave(have);
    }
  };

  // Patch E: JS-side duplicate breaker + streak metrics
  const lastAcceptedAtRef = useRef(0);
  const lastAcceptedRawRef = useRef<string | null>(null);
  const sameStreakRef = useRef(0);
  const cooldownUntilRef = useRef(0);
  const repeatsTotalRef = useRef(0);
  const maxSameStreakRef = useRef(0);
  const uniquePartsSetRef = useRef<Set<string>>(new Set());
  const JS_DUPLICATE_MS = 200; // increased throttle for identical raw (ms)
  const DUPLICATE_WINDOW_TTL = 1000; // ms: if raw in seenSet and within this window, drop
  const SAME_STREAK_LIMIT = 3;
  const SAME_STREAK_COOLDOWN_MS = 400;


  const workerLoop = async () => {
    if (processingRef.current) return;
    processingRef.current = true;
    try {
      while (pendingPartsQueueRef.current.length > 0 && !lockedRef.current) {
        const batchCount = Math.min(2, pendingPartsQueueRef.current.length);
        for (let i = 0; i < batchCount; i++) {
          const part = pendingPartsQueueRef.current.shift() as string;
          partsProcessedRef.current++;
          try {
            if (!decoder) decoder = new BlueURDecoder();
            decoder.receivePart(part);
            // throttle progress updates
            const have = Math.floor(decoder.estimatedPercentComplete() * 100);
            throttledSetProgress(have, 100);
            if (decoder.isComplete()) {
              const data = decoder.toString();
              decoder = undefined;
              // success -- log summary
              perfRef.current.firstSuccessAt = perfRef.current.firstSuccessAt || Date.now();
              const t0 = perfRef.current.t0;
              const t2 = perfRef.current.previewReady;
              const firstAttempt = perfRef.current.firstAttemptAt;
              const firstSuccess = perfRef.current.firstSuccessAt;
              const partsProcessed = partsProcessedRef.current;
              const peakQueue = peakQueueRef.current;
              const ms_after_preview = t2 && firstSuccess ? (firstSuccess - t2) : 0;
              const uniquePartsCount = uniquePartsSetRef.current.size;
              const repeatsTotal = repeatsTotalRef.current;
              const maxSameStreak = maxSameStreakRef.current;
              const lastPartHead = (lastAcceptedRawRef.current || '').slice(0,20).replace(/\n/g,'\\n');
              const summary = {
                t0,
                t2,
                firstAttempt,
                firstSuccess,
                ms_after_preview,
                partsProcessed,
                peakQueue,
                uniquePartsCount,
                repeatsTotal,
                maxSameStreak,
                lastPartHead,
              };
              console.debug('QR PERF SUMMARY ' + JSON.stringify(summary));

              if (launchedBy) {
                const merge = true;
                const popToAction = StackActions.popTo(launchedBy, { onBarScanned: data }, { merge });
                if (onBarScanned) onBarScanned(data, useBBQRRef.current);
                // lock before navigation
                lockedRef.current = true;
                navigation.dispatch(popToAction);
              }
              // we're done
              processingRef.current = false;
              return;
            }
          } catch (e: any) {
            // ignore malformed parts, continue
            console.log('Invalid animated qr code fragment (worker): ' + (e?.message || e));
          }
        }
        // yield to UI / allow other JS tasks
        // eslint-disable-next-line no-await-in-loop
        await new Promise(r => setTimeout(r, 0));
      }
    } finally {
      processingRef.current = false;
    }
  };

  useEffect(() => {
    isCameraAuthorizationStatusGranted().then(setCameraStatusGranted);
    perfRef.current.t0 = Date.now();
    // Log BUILD_INFO for easy verification of running bundle
    try {
      const info = { commit: 'bot/qr-speed', branch: 'bot/qr-speed' };
      console.info('BUILD_INFO ' + JSON.stringify(info));
    } catch (e) {}

    // Auto-enable animatedMode for multisig / watch-only flows based on launchedBy heuristic
    try {
      const l = String(launchedBy || '').toLowerCase();
      if (l.includes('send') || l.includes('multisig') || l.includes('watch') || l.includes('psbt') || l.includes('sign')) {
        setAnimatedMode(true);
      }
    } catch (e) {}

    // Force runtime override for camera props to speed iteration (ungated)
    try {
      const devForce = {
        scanThrottleDelayMs: 300,
        forceRoi: { x: 0.25, y: 0.325, width: 0.4, height: 0.35 },
      };
      // @ts-ignore
      setScanThrottleDelayMs?.(devForce.scanThrottleDelayMs);
      // @ts-ignore
      setAnimatedMode(true);
      // @ts-ignore
      setForcedRoi && setForcedRoi(devForce.forceRoi);
      console.info('FORCE QR: runtime camera override applied ' + JSON.stringify(devForce));
    } catch (e) {
      // swallow
    }
  }, []);
useEffect(() => {
  return () => {
    // cleanup beim Verlassen des Screens
    scannedCacheRef.current = {};
    decoder = undefined;
    useBBQRRef.current = false;
    setAnimatedQRCodeData({});
    setUrHave(0);
    setUrTotal(0);
  };
}, []);

  const HashIt = function (s: string): string {
    return uint8ArrayToHex(sha256(s));
  };

  const _onReadUniformResourceV2 = (part: string) => {
    if (!decoder) decoder = new BlueURDecoder();
    try {
      decoder.receivePart(part);
      if (decoder.isComplete()) {
        const data = decoder.toString();
        decoder = undefined; // nullify for future use (?)
        if (launchedBy) {
          const merge = true;
          const popToAction = StackActions.popTo(launchedBy, { onBarScanned: data }, { merge });
          if (onBarScanned) {
            onBarScanned(data, useBBQRRef.current);
          }

          navigation.dispatch(popToAction);
        }
      } else {
        setUrTotal(100);
        setUrHave(Math.floor(decoder.estimatedPercentComplete() * 100));
      }
    } catch (error: any) {
      console.log('Invalid animated qr code fragment: ' + error.message + ' (continuing scanning)');
    }
  };

  /**
   *
   * @deprecated remove when we get rid of URv1 support
   */
  const _onReadUniformResource = (ur: string) => {
    try {
      const [index, total] = extractSingleWorkload(ur);
      animatedQRCodeData[index + 'of' + total] = ur;
      setUrTotal(total);
      setUrHave(Object.values(animatedQRCodeData).length);
      if (Object.values(animatedQRCodeData).length === total) {
        const payload = decodeUR(Object.values(animatedQRCodeData));
        // lets look inside that data
        let data: false | string = false;
        if (uint8ArrayToString(hexToUint8Array(String(payload))).startsWith('psbt')) {
          // its a psbt, and whoever requested it expects it encoded in base64
          data = uint8ArrayToBase64(hexToUint8Array(String(payload)));
        } else {
          // its something else. probably plain text is expected
          data = uint8ArrayToString(hexToUint8Array(String(payload)));
        }
        if (launchedBy) {
          const merge = true;
          const popToAction = StackActions.popTo(launchedBy, { onBarScanned: data }, { merge });
          if (onBarScanned) {
            onBarScanned(data, useBBQRRef.current);
          }

          navigation.dispatch(popToAction);
        }
      } else {
        setAnimatedQRCodeData(animatedQRCodeData);
      }
    } catch (error: any) {
      console.log('Invalid animated qr code fragment: ' + error.message + ' (continuing scanning)');
    }
  };

  const onBarCodeRead = (ret: { data: string }) => {
    // instrumentation: count attempts and log once/sec
    perfRef.current.attempts++;
    const now = Date.now();
    if (!perfRef.current.firstAttemptAt) perfRef.current.firstAttemptAt = now;
    if (now - perfRef.current.lastFlush > 1000) {
      const unique = uniquePartsSetRef.current.size;
      const repeats = repeatsTotalRef.current;
      const streak = maxSameStreakRef.current;
      const attempts = perfRef.current.attempts;
      const accepted = acceptedThisSecondRef.current;
      const uniqueThisSecond = uniqueThisSecondRef.current;
      const droppedSameStreak = droppedSameStreakCountRef.current;
      const droppedDuplicateWindow = droppedDuplicateWindowCountRef.current;
      const effectiveThrottle = (sessionThrottleOverride !== undefined) ? sessionThrottleOverride : (animatedMode ? 80 : 0);
      console.debug(`QR PERF: attempts/sec=${attempts} unique=${unique} repeats=${repeats} streak=${streak} acceptedThisSec=${accepted} uniqueThisSec=${uniqueThisSecond} droppedSameStreak=${droppedSameStreak} droppedDupWindow=${droppedDuplicateWindow} scanThrottleDelayMs=${effectiveThrottle} t0=${perfRef.current.t0}`);
      // reset per-second counters
      perfRef.current.attempts = 0;
      perfRef.current.lastFlush = now;
      acceptedThisSecondRef.current = 0;
      uniqueThisSecondRef.current = 0;
    }

  const h = HashIt(ret.data);
  const scannedCache = scannedCacheRef.current;

    // Debug raw fragment details for first N events when enabled
    if (DEBUG_ANIMATED && debugCountRef.current < DEBUG_MAX) {
      try {
        const raw = ret.data || '';
        const len = raw.length;
        const head = raw.slice(0, 20).replace(/\n/g, '\\n');
        const up = raw.toUpperCase();
        const isURcrypto = up.startsWith('UR:CRYPTO-');
        const isURbytes = up.startsWith('UR:BYTES');
        const isBBQR = up.startsWith('B$');
        // will be set later if enqueued
        console.debug(`QR RAW: len=${len} head="${head}" urCrypto=${isURcrypto} urBytes=${isURbytes} bbqr=${isBBQR} enq=UNKNOWN`);
        debugCountRef.current++;
      } catch (e) {
        console.debug('QR RAW: debug logging failed: ' + (e?.message || e));
      }
    }

    // JS-side duplicate breaker for animated sessions
    if (animatedMode) {
      const raw = ret.data || '';
      const now2 = Date.now();
      // if in cooldown, drop identical
      if (cooldownUntilRef.current && now2 < cooldownUntilRef.current && raw === lastAcceptedRawRef.current) {
        repeatsTotalRef.current++;
        // track droppedSameStreakCount
        // @ts-ignore
        droppedSameStreakCountRef.current = (droppedSameStreakCountRef.current || 0) + 1;
        return;
      }
      // if raw already seen recently, drop
      if (uniquePartsSetRef.current.has(raw) && lastAcceptedAtRef.current && now2 - lastAcceptedAtRef.current < DUPLICATE_WINDOW_TTL) {
        repeatsTotalRef.current++;
        // @ts-ignore
        droppedDuplicateWindowCountRef.current = (droppedDuplicateWindowCountRef.current || 0) + 1;
        return;
      }
      if (raw === lastAcceptedRawRef.current) {
        if (now2 - lastAcceptedAtRef.current < JS_DUPLICATE_MS) {
          repeatsTotalRef.current++;
          sameStreakRef.current = (sameStreakRef.current || 0) + 1;
          maxSameStreakRef.current = Math.max(maxSameStreakRef.current, sameStreakRef.current);
          if (sameStreakRef.current >= SAME_STREAK_LIMIT) {
            cooldownUntilRef.current = now2 + SAME_STREAK_COOLDOWN_MS;
            // drop this and subsequent identical parts during cooldown
            repeatsTotalRef.current++;
            // @ts-ignore
            droppedSameStreakCountRef.current = (droppedSameStreakCountRef.current || 0) + 1;
            return;
          }
          return; // drop quick duplicate
        } else {
          // accepted after throttle
          lastAcceptedAtRef.current = now2;
          sameStreakRef.current = (lastAcceptedRawRef.current === raw) ? sameStreakRef.current + 1 : 1;
          maxSameStreakRef.current = Math.max(maxSameStreakRef.current, sameStreakRef.current);
          uniquePartsSetRef.current.add(raw);
        }
      } else {
        // different part; accept
        lastAcceptedRawRef.current = raw;
        lastAcceptedAtRef.current = now2;
        sameStreakRef.current = 1;
        uniquePartsSetRef.current.add(raw);
      }
    }

    if (scannedCache[h]) {
      // schon gesehen → nicht nochmal decoden
      return;
    }
    scannedCache[h] = Date.now();

    if (lockedRef.current) {
      // already locked / navigating
      return;
    }

    // Animated UR/BBQR -> enqueue and process with backpressure
    const up = ret.data.toUpperCase();
    if (up.startsWith('UR:CRYPTO-ACCOUNT') || up.startsWith('UR:CRYPTO-PSBT') || up.startsWith('UR:CRYPTO-OUTPUT') || up.startsWith('B$')) {
      if (up.startsWith('B$')) useBBQRRef.current = true;
      const now = Date.now();
      const key = makeDedupeKey(ret.data);
      const last = dedupeMapRef.current.get(key) || 0;
      if (now - last < DEDUPE_TTL_MS) {
        // recently seen, ignore
        return;
      }
      dedupeMapRef.current.set(key, now);
      cleanupDedupeIfNeeded();
      const q = pendingPartsQueueRef.current;
      q.push(ret.data);
      if (q.length > QUEUE_CAP) {
        q.shift(); // drop oldest
      }
      peakQueueRef.current = Math.max(peakQueueRef.current, q.length);
      // debug: log enqueue
      if (DEBUG_ANIMATED && debugCountRef.current < DEBUG_MAX) {
        console.debug(`QR RAW: len=${ret.data.length} head="${ret.data.slice(0,20)}" urCrypto=${up.startsWith('UR:CRYPTO-')} urBytes=${up.startsWith('UR:BYTES')} bbqr=${up.startsWith('B$')} enq=true`);
        debugCountRef.current++;
      }
      // ensure firstAttempt timestamp
      if (!perfRef.current.firstAttemptAt) perfRef.current.firstAttemptAt = now;
      // mark animated mode for this session
      setAnimatedMode(true);
      // track accepted/dropped counters for telemetry
      acceptedThisSecondRef.current++;
      uniqueThisSecondRef.current += uniquePartsSetRef.current.has(ret.data) ? 0 : 1;
      // start worker async without blocking
      setTimeout(() => workerLoop(), 0);
      return;
    }

    if (up.startsWith('UR:BYTES')) {
      const splitted = ret.data.split('/');
      if (splitted.length === 3 && splitted[1].includes('-')) {
        const now = Date.now();
        const key = makeDedupeKey(ret.data);
        const last = dedupeMapRef.current.get(key) || 0;
        if (now - last < DEDUPE_TTL_MS) return;
        dedupeMapRef.current.set(key, now);
        cleanupDedupeIfNeeded();
        pendingPartsQueueRef.current.push(ret.data);
        if (pendingPartsQueueRef.current.length > QUEUE_CAP) pendingPartsQueueRef.current.shift();
        peakQueueRef.current = Math.max(peakQueueRef.current, pendingPartsQueueRef.current.length);
        if (!perfRef.current.firstAttemptAt) perfRef.current.firstAttemptAt = now;
        setAnimatedMode(true);
        setTimeout(() => workerLoop(), 0);
        return;
      }
    }

    if (ret.data.toUpperCase().startsWith('UR')) {
      return _onReadUniformResource(ret.data);
    }

    // is it base43? stupid electrum desktop
    try {
      const hex = Base43.decode(ret.data);
      bitcoin.Psbt.fromHex(hex); // if it doesnt throw - all good
      const data = uint8ArrayToBase64(hexToUint8Array(hex));

      if (launchedBy) {
        lockedRef.current = true;
        perfRef.current.firstSuccessAt = Date.now();
        const merge = true;
        const popToAction = StackActions.popTo(launchedBy, { onBarScanned: data }, { merge });
        if (onBarScanned) {
          onBarScanned(data, useBBQRRef.current);
        }
        navigation.dispatch(popToAction);
      }
      return;
    } catch (_) {
      if (!isLoading && launchedBy) {
        setIsLoading(true);
        try {
          lockedRef.current = true;
          perfRef.current.firstSuccessAt = Date.now();
          const merge = true;

          const popToAction = StackActions.popTo(launchedBy, { onBarScanned: ret.data }, { merge });
          if (onBarScanned) {
            onBarScanned(ret.data, useBBQRRef.current);
          }

          navigation.dispatch(popToAction);
        } catch (e) {
          console.log(e);
        }
      }
    }
    setIsLoading(false);
  };

  const showFilePicker = async () => {
    setIsLoading(true);
    const { data } = await fs.showFilePickerAndReadFile();
    if (data) onBarCodeRead({ data });
    setIsLoading(false);
  };

  const onShowImagePickerButtonPress = () => {
    if (!isLoading) {
      setIsLoading(true);
      fs.showImagePickerAndReadImage()
        .then(data => {
          if (data) onBarCodeRead({ data });
        })
        .finally(() => setIsLoading(false));
    }
  };

  const dismiss = () => {
    navigation.goBack();
  };

  const handleReadCode = (event: any) => {
    // debug which nativeEvent field we use
    if (DEBUG_ANIMATED && debugCountRef.current < DEBUG_MAX) {
      const used = event?.nativeEvent?.codeStringValue ? 'codeStringValue' : 'missing';
      console.debug(`QR RAW FIELD: using=${used} nativeEvent keys=${Object.keys(event?.nativeEvent || {}).join(',')}`);
    }
    onBarCodeRead({ data: event?.nativeEvent?.codeStringValue });
  };

  const handleBackdoorOkPress = () => {
    setBackdoorVisible(false);
    setBackdoorText('');
    if (backdoorText) onBarCodeRead({ data: backdoorText });
  };

  // this is an invisible backdoor button on bottom left screen corner
  // tapping it 10 times fires prompt dialog asking for a string thats gona be passed to onBarCodeRead.
  // this allows to mock and test QR scanning in e2e tests
  const handleInvisibleBackdoorPress = async () => {
    setBackdoorPressed(backdoorPressed + 1);
    if (backdoorPressed < 5) return;
    setBackdoorPressed(0);
    setBackdoorVisible(true);
  };

  const render = isLoading ? (
    <BlueLoading />
  ) : (
    <View>
      {cameraStatusGranted === false ? (
        <View style={[styles.openSettingsContainer, stylesHook.openSettingsContainer]}>
          <BlueText>{loc.send.permission_camera_message}</BlueText>
          <BlueSpacing40 />
          <Button title={loc.send.open_settings} onPress={openPrivacyDesktopSettings} />
          <BlueSpacing40 />
          {showFileImportButton && <Button title={loc.wallets.import_file} onPress={showFilePicker} />}
          <BlueSpacing40 />
          <Button title={loc.wallets.list_long_choose} onPress={onShowImagePickerButtonPress} />
          <BlueSpacing40 />
          <Button title={loc._.cancel} onPress={dismiss} />
        </View>
      ) : isFocused && cameraStatusGranted ? (
        <CameraScreen
          onReadCode={handleReadCode}
          showFilePickerButton={showFileImportButton}
          showImagePickerButton={true}
          onFilePickerButtonPress={showFilePicker}
          onImagePickerButtonPress={onShowImagePickerButtonPress}
          onCancelButtonPress={dismiss}
          // pass forced props explicitly so CameraScreen receives them
          // @ts-ignore
          scanThrottleDelayMs={typeof (global as any).forcedScanThrottle === 'number' ? (global as any).forcedScanThrottle : (sessionThrottleOverride !== undefined ? sessionThrottleOverride : (animatedMode ? 300 : 0))}
          // @ts-ignore
          forcedRoi={typeof (global as any).forcedRoi === 'object' ? (global as any).forcedRoi : (animatedMode ? { x: 0.25, y: 0.325, width: 0.4, height: 0.35 } : null)}
          onPreviewReady={() => {
            // record preview ready timestamp once
            if (!perfRef.current.previewReady) {
              perfRef.current.previewReady = Date.now();
              // Log previewReady and camera config (JSON single-line)
              const cfg = {
                animatedMode: animatedMode,
                queueCap: QUEUE_CAP,
                progressThrottleMs: PROGRESS_THROTTLE_MS,
                jsDuplicateMs: JS_DUPLICATE_MS,
                duplicateWindowTtl: DUPLICATE_WINDOW_TTL,
                cameraScanThrottleMs: (sessionThrottleOverride !== undefined) ? sessionThrottleOverride : (animatedMode ? 100 : 0),
                resetFocusWhenMotionDetected: animatedMode ? true : false,
                roi: animatedMode ? { x: 0.175, y: 0.325, width: 0.65, height: 0.35 } : null,
              };
              console.info('QR CAM CFG ' + JSON.stringify(cfg));
              console.debug(`QR PERF: previewReady t2=${perfRef.current.previewReady}`);
            }
          }}
        />
      ) : null}
      {urTotal > 0 && (
        <View style={[styles.progressWrapper, stylesHook.progressWrapper]} testID="UrProgressBar">
          <BlueText>{loc.wallets.please_continue_scanning}</BlueText>
          <BlueText>
            {urHave} / {urTotal}
          </BlueText>
        </View>
      )}
      {backdoorVisible && (
        <View style={styles.backdoorInputWrapper}>
          <BlueText>Provide QR code contents manually:</BlueText>
          <TextInput
            testID="scanQrBackdoorInput"
            multiline
            underlineColorAndroid="transparent"
            style={[styles.backdoorInput, stylesHook.backdoorInput]}
            autoCorrect={false}
            autoCapitalize="none"
            spellCheck={false}
            selectTextOnFocus={false}
            keyboardType={Platform.OS === 'android' ? 'visible-password' : 'default'}
            value={backdoorText}
            onChangeText={setBackdoorText}
          />
          <Button title="OK" testID="scanQrBackdoorOkButton" onPress={handleBackdoorOkPress} />
        </View>
      )}
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel={loc._.qr_custom_input_button}
        testID="ScanQrBackdoorButton"
        style={styles.backdoorButton}
        onPress={handleInvisibleBackdoorPress}
      />
    </View>
  );

  return <SafeArea style={styles.root}>{render}</SafeArea>;
};

export default ScanQRCode;
