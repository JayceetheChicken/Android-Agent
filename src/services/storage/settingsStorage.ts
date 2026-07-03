import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

import { DEFAULT_BASE_URL, DEFAULT_MODEL, STORAGE_KEYS } from '../../config/constants';
import type { AISettings } from '../../types/settings';

/**
 * The API key lives in SecureStore (encrypted keystore).
 * Base URL and model name are not secrets and live in AsyncStorage.
 * API keys are NEVER hardcoded and NEVER written to the sandbox or logs.
 */
export async function loadSettings(): Promise<AISettings> {
  const [apiKey, baseUrl, model] = await Promise.all([
    SecureStore.getItemAsync(STORAGE_KEYS.apiKey),
    AsyncStorage.getItem(STORAGE_KEYS.baseUrl),
    AsyncStorage.getItem(STORAGE_KEYS.model),
  ]);

  return {
    apiKey: apiKey ?? '',
    baseUrl: baseUrl ?? DEFAULT_BASE_URL,
    model: model ?? DEFAULT_MODEL,
  };
}

export async function saveSettings(settings: AISettings): Promise<void> {
  await Promise.all([
    settings.apiKey.length > 0
      ? SecureStore.setItemAsync(STORAGE_KEYS.apiKey, settings.apiKey)
      : SecureStore.deleteItemAsync(STORAGE_KEYS.apiKey),
    AsyncStorage.setItem(STORAGE_KEYS.baseUrl, settings.baseUrl.trim()),
    AsyncStorage.setItem(STORAGE_KEYS.model, settings.model.trim()),
  ]);
}
