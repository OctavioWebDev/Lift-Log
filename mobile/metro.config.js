const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

// expo-sqlite's web backend loads a wasm build (wa-sqlite) — without this Metro
// tries to parse the .wasm file as JS and fails to bundle for web at all.
// Native (iOS/Android) builds are unaffected by this.
config.resolver.assetExts.push("wasm");

module.exports = config;
