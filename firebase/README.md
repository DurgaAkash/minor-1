# SmartRoute AI – Firebase setup

This folder contains the starter Firestore security rules. The app does **not** use cloud storage until Firebase configuration and Authentication are completed.

## 1. Create the Firebase project

1. Open https://console.firebase.google.com/ and create a project.
2. Register a Web App and copy its Firebase web configuration.
3. Enable **Authentication → Sign-in method → Email/Password**.
4. Create a **Cloud Firestore** database.

## 2. Add the web configuration

Open `js/firebase-config.js` and replace each `PASTE_...` value with the matching field from your Firebase Web App configuration.

The Firebase web configuration is intended for browser apps. Never put a service-account JSON file, private key, or Admin SDK credentials in this repository.

## 3. Publish Firestore rules

Open Firestore → Rules, copy the contents of `firebase/firestore.rules`, and publish them.

These rules require authenticated Firebase users. Admin access requires the trusted custom claim `admin: true`, assigned from a secure Admin SDK environment. Do not set this claim from frontend JavaScript or trust a user-editable Firestore role field.

## 4. Important current status

The current passenger/admin login screens still use demo credentials and localStorage. They do not sign users into Firebase Authentication yet. Therefore the cloud adapter is a prepared integration layer and Firestore operations remain unavailable until the next authentication integration is completed.

Until then, the existing local demo continues to work. Do not loosen Firestore rules to public read/write just to make the demo connect.
