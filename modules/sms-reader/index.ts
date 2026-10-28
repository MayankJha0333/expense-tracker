// Re-export the native module. On web, it will be resolved to SmsReaderModule.web.ts
// and on native platforms to SmsReaderModule.ts
export { default } from './src/SmsReaderModule';
export * from './src/SmsReader.types';
