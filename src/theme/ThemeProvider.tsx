import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors as lightColors } from './index';

const STORAGE_KEY = 'solid-connect:color-scheme';

export type ThemeScheme = 'light' | 'dark';
export type ThemeColors = typeof lightColors;

/** Near-monochrome dark invert of the receipt/MoMo light palette. */
export const darkColors: ThemeColors = {
  ...lightColors,
  paper: '#0B0B0A',
  paperDim: '#1C1C1C',
  card: '#1C1C1C',
  ink: '#F2F2F1',
  inkMuted: 'rgba(242,242,241,0.62)',
  inkFaint: 'rgba(242,242,241,0.42)',
  inkFainter: 'rgba(242,242,241,0.26)',
  hairline: '#2E2E2C',
  hairlineStrong: '#3C3C3A',
  confirmBg: '#0E2A1C',
  pendingBg: '#2A2208',
  dangerBg: '#2A1410',
  navyBg: '#1A2434',
  bg: '#0B0B0A',
  surface: '#1C1C1C',
  tile: '#1C1C1C',
  tileBorder: '#2E2E2C',
  hairlineSoft: '#1C1C1C',
  inputBorder: '#2E2E2C',
  textPrimary: '#F2F2F1',
  textHeading: '#F2F2F1',
  textBody: 'rgba(242,242,241,0.62)',
  textMuted: 'rgba(242,242,241,0.62)',
  textFaint: 'rgba(242,242,241,0.42)',
  textDim: 'rgba(242,242,241,0.26)',
  successBg: '#0E2A1C',
};

type ThemeContextValue = {
  colors: ThemeColors;
  scheme: ThemeScheme;
  setScheme: (scheme: ThemeScheme) => void;
};

const ThemeContext = createContext<ThemeContextValue>({
  colors: lightColors,
  scheme: 'light',
  setScheme: () => {},
});

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [scheme, setSchemeState] = useState<ThemeScheme>('light');

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (raw === 'dark' || raw === 'light') setSchemeState(raw);
      })
      .catch(() => {});
  }, []);

  function setScheme(next: ThemeScheme) {
    setSchemeState(next);
    AsyncStorage.setItem(STORAGE_KEY, next).catch(() => {});
  }

  return (
    <ThemeContext.Provider
      value={{
        colors: scheme === 'dark' ? darkColors : lightColors,
        scheme,
        setScheme,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
