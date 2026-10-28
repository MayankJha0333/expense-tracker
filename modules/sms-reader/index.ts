// Re-export the native modules. On web they resolve to the *.web.ts stubs (null).
export { default } from './src/SmsReaderModule';
export { default as DeviceGuard } from './src/DeviceGuardModule';
export * from './src/SmsReader.types';
