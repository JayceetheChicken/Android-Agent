/**
 * AI provider settings. The API key is stored in SecureStore,
 * baseUrl/model in AsyncStorage (see services/storage/settingsStorage.ts).
 */
export interface AISettings {
  apiKey: string;
  baseUrl: string;
  model: string;
}
