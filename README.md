## Self-hosted GroundControl + Push (FCM) – Quickstart

This fork is a BlueWallet Android build that can use a fully self-hosted GroundControl server.
Goal: self-hosted push notifications + maximum privacy/control (no dependency on official BlueWallet backends).

Self-hosted push pipeline (unconfirmed/received/confirmed) confirmed working with our GroundControl fork.


### Components
- **Android app (this repo)**: React Native build
- **GroundControl (server repo)**: Node.js/TypeScript + MariaDB
- **Firebase (FCM)**: own Firebase project + service account key (server-side)
## Backend: Self-hosted GroundControl

This app is designed to work with a self-hosted GroundControl server:

**GroundControl fork (server):**
https://github.com/Alex71btc/GroundControl

The fork adds:

- Fully self-hosted push notifications (FCM)
- Separate push tags for:
- unconfirmed
- received
- confirmed transactions
- Token auto-cleanup for uninstalled apps

### Prerequisites (Android)
- Ubuntu 24.04
- Android SDK / platform-tools (`adb`)
- JDK 17 (recommended for modern AGP)
- Node.js + yarn/npm as required by the repo

### Firebase (Android): google-services.json (DO NOT COMMIT)

Push notifications use Firebase Cloud Messaging (FCM).  
To build the Android app with your own Firebase project you must provide a local `google-services.json`.

1) Create / open your Firebase project in the Firebase Console.

2) Add an **Android app** to the project:
   - **Package name** must match the app's `applicationId` (see `android/app/build.gradle`).
   - (Optional) Add SHA-1 / SHA-256 fingerprints if you use features that require it.

3) Download **google-services.json** from Firebase and place it here:

   `android/app/google-services.json`

4) **Never commit** this file. It must stay local.
   This repo ignores it via `.gitignore`:
   - `android/app/google-services.json`
   - `android/app/google-services.json.local`

Notes:
- `google-services.json` contains project identifiers and API keys.
  Treat it as sensitive and keep it out of Git history.
- Server-side FCM for GroundControl is configured separately (Firebase service account key on the server).

### App: Configure GroundControl URL
In the app:
1. Settings → **Network** → **Notifications** (GroundControl)
2. Tap the hidden “Major Tom” text 10× (Developer section appears)
3. Enter your GroundControl URL (example: `http://<LAN-IP>:3000`) and Save

### Release build (signed APK)
This repo supports local release signing via Gradle properties.

**Keystore** (example path):
`~/.keystores/bluewallet-gc.jks`

**Gradle properties** (local, do NOT commit):
`~/.gradle/gradle.properties`
```properties
RELEASE_STORE_FILE=/home/<user>/.keystores/bluewallet-gc.jks
RELEASE_STORE_PASSWORD=...
RELEASE_KEY_ALIAS=bluewallet-gc
RELEASE_KEY_PASSWORD=...

Build:

cd android
./gradlew clean
./gradlew assembleRelease
ls -la app/build/outputs/apk/release/


Install:

adb devices -l
adb install -r android/app/build/outputs/apk/release/app-release.apk

Notes

Keep secrets out of git (google-services.json, keystore, Gradle props, .env).

Push notifications are expected to work with a self-hosted GroundControl when the server is configured with your Firebase service account.
# BlueWallet - A Bitcoin & Lightning Wallet

[![GitHub tag](https://img.shields.io/badge/dynamic/json.svg?url=https://raw.githubusercontent.com/BlueWallet/BlueWallet/master/package.json&query=$.version&label=Version)](https://github.com/BlueWallet/BlueWallet)
[![CircleCI](https://circleci.com/gh/BlueWallet/BlueWallet.svg?style=svg)](https://circleci.com/gh/BlueWallet/BlueWallet)
[![code style: prettier](https://img.shields.io/badge/code_style-prettier-ff69b4.svg?style=flat-square)](https://github.com/prettier/prettier)
![](https://img.shields.io/github/license/BlueWallet/BlueWallet.svg)

Thin Bitcoin Wallet.
Built with React Native and Electrum.

[![Appstore](https://bluewallet.io/uploads/app-store-badge-blue.svg)](https://itunes.apple.com/us/app/bluewallet-bitcoin-wallet/id1376878040?l=ru&ls=1&mt=8)
[![Playstore](https://bluewallet.io/uploads/play-store-badge-blue.svg)](https://play.google.com/store/apps/details?id=io.bluewallet.bluewallet)

Website: [bluewallet.io](https://bluewallet.io)

Community: [telegram group](https://t.me/bluewallet)

* Private keys never leave your device
* Lightning Network supported
* SegWit-first. Replace-By-Fee support
* Encryption. Plausible deniability
* And many more [features...](https://bluewallet.io/features)


<img src="https://i.imgur.com/hHYJnMj.png" width="100%">


## BUILD & RUN IT

Please refer to the engines field in package.json file for the minimum required versions of Node and npm. It is preferred that you use an even-numbered version of Node as these are LTS versions.

To view the version of Node and npm in your environment, run the following in your console:

```
node --version && npm --version
```

* In your console:

```
git clone https://github.com/BlueWallet/BlueWallet.git
cd BlueWallet
npm install
```

Please make sure that your console is running the most stable versions of npm and node (even-numbered versions).

* To run on Android:

You will now need to either connect an Android device to your computer or run an emulated Android device using AVD Manager which comes shipped with Android Studio. To run an emulator using AVD Manager:

1. Download and run Android Studio
2. Click on "Open an existing Android Studio Project"
3. Open `build.gradle` file under `BlueWallet/android/` folder
4. Android Studio will take some time to set things up. Once everything is set up, go to `Tools` -> `AVD Manager`.
    * 📝 This option [may take some time to appear in the menu](https://stackoverflow.com/questions/47173708/why-avd-manager-options-are-not-showing-in-android-studio) if you're opening the project in a freshly-installed version of Android Studio.
5. Click on "Create Virtual Device..." and go through the steps to create a virtual device
6. Launch your newly created virtual device by clicking the `Play` button under `Actions` column

Once you connected an Android device or launched an emulator, run this:

```
npx react-native run-android
```

The above command will build the app and install it. Once you launch the app it will take some time for all of the dependencies to load. Once everything loads up, you should have the built app running.

* To run on iOS:

```
npx pod-install
npm start
```

In another terminal window within the BlueWallet folder:
```
npx react-native run-ios
```
**To debug BlueWallet on the iOS Simulator, you must choose a Rosetta-compatible iOS Simulator. This can be done by navigating to the Product menu in Xcode, selecting Destination Architectures, and then opting for "Show Both." This action will reveal the simulators that support Rosetta.
**

* To run on macOS using Mac Catalyst:

```
npx pod-install
npm start
```

Open ios/BlueWallet.xcworkspace. Once the project loads, select the scheme/target BlueWallet. Click Run.

## TESTS

```bash
npm run test
```


## LICENSE

MIT

## WANT TO CONTRIBUTE?

Grab an issue from [the backlog](https://github.com/BlueWallet/BlueWallet/issues), try to start or submit a PR, any doubts we will try to guide you. Contributors have a private telegram group, request access by email bluewallet@bluewallet.io

## Translations

We accept translations via [Transifex](https://www.transifex.com/bluewallet/bluewallet/)

To participate you need to:
1. Sign up to Transifex
2. Find BlueWallet project
3. Send join request
4. After we accept your request you will be able to start translating! That's it!

Please note the values in curly braces should not be translated. These are the names of the variables that will be inserted into the translated string. For example, the original string `"{number} of {total}"` in Russian will be `"{number} из {total}"`.

Transifex automatically creates Pull Request when language reaches 100% translation. We also trigger this by hand before each release, so don't worry if you can't translate everything, every word counts.

## Q&A

Builds automated and tested with BrowserStack

<a href="https://www.browserstack.com/"><img src="https://i.imgur.com/syscHCN.png" width="160px"></a>

Bugs reported via BugSnag

<a href="https://www.bugsnag.com"><img src="https://images.typeform.com/images/QKuaAssrFCq7/image/default" width="160px"></a>


## RESPONSIBLE DISCLOSURE

Found critical bugs/vulnerabilities? Please email them bluewallet@bluewallet.io
Thanks!
