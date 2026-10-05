// Polyfills must run before ANY other module loads
require('./shims/crypto-polyfill')
require('./shims/buffer-polyfill')
require('./shims/hermes-class-fix')

// Now load expo-router
require('expo-router/entry')
