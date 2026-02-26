# BlueWallet-GC – Quick Operator Notes (Alex)

## 🎯 Ziel dieses Forks

* Self-hosted BlueWallet mit Ground Control
* **Zwei stabile Build-Linien:**

  * 🟢 `old-perf` → basiert auf ~7.2.3/7.2.4 + TX-Dates + bekannte Performance
  * 🚀 `qr-fast-7.2.6` → basiert auf 7.2.6 + schneller Animated-QR-Scan
* Privacy-fokussiert (`react-native-camera-kit-no-google`)

---

## 🌿 Wichtige Branches

| Branch          | Zweck                                  |
| --------------- | -------------------------------------- |
| `master`        | Hauptlinie mit old-perf Verbesserungen |
| `old-perf`      | konservative stabile Linie             |
| `feat/qr-speed` | neue QR-Performance Arbeit             |
| `gc-v7.2.6`     | Upstream-Basis                         |

---

## 🏷️ Wichtige Tags (Release-Anker)

Diese Tags sind die **Build-Wahrheit**:

* `oldperf-txdate-2026-02-26`
  → stabile alte Linie + TX-Datum

* `qr-fast-7.2.6`
  → v7.2.6 + schneller Animated QR

👉 Immer von Tags bauen für reproduzierbare APKs.

---

## 🔨 Release Build (Android)

### 1️⃣ Sauber auschecken

```bash
git fetch --all --tags
git checkout <TAG>
```

Beispiel:

```bash
git checkout qr-fast-7.2.6
```

---

### 2️⃣ Dependencies

```bash
npm ci
cd android
./gradlew clean
```

---

### 3️⃣ Release APK bauen

```bash
./gradlew :app:assembleRelease
```

APK liegt dann in:

```
android/app/build/outputs/apk/release/app-release.apk
```

---

## 📦 Release archivieren (WICHTIG!)

### APK sichern

```bash
mkdir -p ~/releases/bluewallet-gc

cp android/app/build/outputs/apk/release/app-release.apk \
  ~/releases/bluewallet-gc/BlueWalletGC-<version>.apk
```

---

### SHA256 erzeugen

```bash
sha256sum ~/releases/bluewallet-gc/BlueWalletGC-<version>.apk \
  | tee ~/releases/bluewallet-gc/BlueWalletGC-<version>.apk.sha256
```

---

### Badging prüfen

```bash
AAPT=~/Android/Sdk/build-tools/35.0.0/aapt

"$AAPT" dump badging <apk> | rg "package: name=|application-label:|versionName="
```

---

## ⚡ QR-Performance Tweaks (aktuell aktiv)

In `CameraScreen.tsx`:

* ✅ `resetFocusWhenMotionDetected={false}`
* ✅ `scanThrottleDelay={30}`
* ✅ `react-native-camera-kit-no-google`

Das ist aktuell der **Sweet Spot**.

---

## 🧭 Wenn Animated QR wieder langsam wird

Checkliste:

* Wurde `scanThrottleDelay` entfernt?
* Ist `resetFocusWhenMotionDetected` wieder `true`?
* Wurde versehentlich `react-native-camera-kit` statt `-no-google` installiert?
* Läuft Debug statt Release?

---

## 🚨 Branch Protection Erinnerung

GitHub Rule aktiv:

* Require linear history (kann Merge blockieren)
* Bot soll **nicht** direkt auf master pushen
* Tags sind die sichere Release-Referenz

---

## 🧠 Persönliche Notiz

Wenn etwas gut funktioniert:

👉 **Tag setzen, bevor weiter gebastelt wird.**

---

*Ende.*
