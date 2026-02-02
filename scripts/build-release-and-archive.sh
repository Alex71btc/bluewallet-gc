#!/usr/bin/env bash
set -euo pipefail

# --- config (edit if you want) ---
REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ANDROID_DIR="$REPO_DIR/android"
APK_REL_PATH="app/build/outputs/apk/release/app-release.apk"

# Default archive dir (change if you prefer)
ARCHIVE_DIR="${ARCHIVE_DIR:-$HOME/Nextcloud/Backups/bluewallet-gc-apk}"

# Optional: install after build (set INSTALL=1)
INSTALL="${INSTALL:-0}"

ts="$(date +%Y%m%d-%H%M)"
mkdir -p "$ARCHIVE_DIR"

echo "[1/4] Building release APK..."
cd "$ANDROID_DIR"
./gradlew clean
./gradlew assembleRelease

APK_PATH="$ANDROID_DIR/$APK_REL_PATH"
if [[ ! -f "$APK_PATH" ]]; then
  echo "ERROR: APK not found at: $APK_PATH"
  echo "Check signingConfig + output path."
  exit 1
fi

echo "[2/4] Copying APK to archive..."
OUT_APK="$ARCHIVE_DIR/bluewallet-gc-${ts}-release.apk"
cp -a "$APK_PATH" "$OUT_APK"

echo "[3/4] Writing SHA256..."
sha256sum "$OUT_APK" | tee "$OUT_APK.sha256"

echo "[4/4] Done."
echo "APK:    $OUT_APK"
echo "SHA256: $OUT_APK.sha256"

if [[ "$INSTALL" == "1" ]]; then
  echo
  echo "[install] Installing via adb..."
  adb devices -l
  adb install -r "$OUT_APK"
  echo "[install] Done."
fi
