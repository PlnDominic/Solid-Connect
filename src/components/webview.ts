import type { ForwardRefExoticComponent, RefAttributes } from 'react';
import RNWebView, { type WebViewProps } from 'react-native-webview';

/** The imperative methods the app calls on a WebView. */
export type WebViewHandle = {
  injectJavaScript: (script: string) => void;
  postMessage: (message: string) => void;
};

/**
 * react-native-webview 14 types its default entry as a plain function
 * component without a `ref`, because TypeScript resolves the shared
 * WebView.d.ts. The iOS and Android builds that actually run are
 * forwardRef components exposing these methods, so type it that way here.
 */
export const WebView = RNWebView as unknown as ForwardRefExoticComponent<
  WebViewProps & RefAttributes<WebViewHandle>
>;
