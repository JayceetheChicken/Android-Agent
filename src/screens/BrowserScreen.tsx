import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { WebView, type WebViewNavigation } from 'react-native-webview';

import { colors, spacing } from '../components/theme';
import { BROWSER_HOME_URL } from '../config/constants';
import * as browserService from '../services/browser/browserService';

/**
 * Mini browser (WebView). The agent controls it indirectly through
 * browserService commands; this screen is the only WebView owner.
 * Only https URLs are loaded (validateUrl).
 */
export function BrowserScreen(): React.JSX.Element {
  const webViewRef = useRef<WebView>(null);
  const [urlInput, setUrlInput] = useState(BROWSER_HOME_URL);
  const [currentUrl, setCurrentUrl] = useState(BROWSER_HOME_URL);
  const [canGoBack, setCanGoBack] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Apply agent commands (open_url / go_back) to the WebView.
  useEffect(() => {
    return browserService.subscribe((command) => {
      if (command.type === 'open_url') {
        setUrlInput(command.url);
        setCurrentUrl(command.url);
        setError(null);
      } else if (command.type === 'go_back') {
        webViewRef.current?.goBack();
      }
    });
  }, []);

  const go = useCallback(() => {
    try {
      const withScheme = /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(urlInput.trim())
        ? urlInput.trim()
        : `https://${urlInput.trim()}`;
      const url = browserService.validateUrl(withScheme);
      setError(null);
      setUrlInput(url);
      setCurrentUrl(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [urlInput]);

  const onNavigationStateChange = useCallback((nav: WebViewNavigation) => {
    setCanGoBack(nav.canGoBack);
    if (nav.url) {
      setUrlInput(nav.url);
    }
    browserService.reportNavigation({
      currentUrl: nav.url,
      currentTitle: nav.title,
      canGoBack: nav.canGoBack,
    });
  }, []);

  return (
    <View style={styles.container}>
      <View style={styles.toolbar}>
        <Pressable
          style={[styles.navButton, !canGoBack && styles.navDisabled]}
          onPress={() => webViewRef.current?.goBack()}
        >
          <Text style={styles.navText}>←</Text>
        </Pressable>
        <TextInput
          style={styles.urlInput}
          value={urlInput}
          onChangeText={setUrlInput}
          onSubmitEditing={go}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          placeholder="https://…"
          placeholderTextColor={colors.textMuted}
        />
        <Pressable style={styles.goButton} onPress={go}>
          <Text style={styles.navText}>Los</Text>
        </Pressable>
      </View>
      {error && <Text style={styles.error}>{error}</Text>}
      <WebView
        ref={webViewRef}
        source={{ uri: currentUrl }}
        style={styles.webview}
        onNavigationStateChange={onNavigationStateChange}
        setSupportMultipleWindows={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  toolbar: {
    flexDirection: 'row',
    gap: spacing.s,
    padding: spacing.s,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  navButton: {
    backgroundColor: colors.surfaceLight,
    borderRadius: 8,
    paddingHorizontal: spacing.m,
    paddingVertical: spacing.s,
  },
  navDisabled: { opacity: 0.4 },
  navText: { color: colors.text, fontSize: 15 },
  urlInput: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: 8,
    color: colors.text,
    paddingHorizontal: spacing.m,
    paddingVertical: spacing.s,
    fontSize: 13,
  },
  goButton: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingHorizontal: spacing.m,
    paddingVertical: spacing.s,
  },
  error: { color: colors.danger, padding: spacing.s, fontSize: 12 },
  webview: { flex: 1 },
});
