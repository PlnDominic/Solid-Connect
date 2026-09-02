// Design tokens lifted from the Claude Design prototype (Solid Connect App.dc.html)

export const colors = {
  ink: '#111113',
  inkSoft: 'rgba(17,17,19,0.65)',
  inkFaint: 'rgba(17,17,19,0.45)',
  inkFainter: 'rgba(17,17,19,0.4)',
  navy: '#1B3A8A',
  orange: '#F27511',
  orangeDeep: '#C85A08',
  bg: '#EDEEF1',
  surface: '#FAFBFC',
  card: '#FFFFFF',
  tile: '#F4F4F5',
  tileBorder: '#E4E4E6',
  hairline: '#E8EBEF',
  hairlineSoft: '#F4F6F8',
  inputBorder: '#D5DAE1',
  textPrimary: '#111113',
  textHeading: '#101825',
  textBody: '#2E3542',
  textMuted: '#4A5261',
  textFaint: '#8A93A1',
  textDim: '#B3BAC5',
  successBg: '#E7F4EE',
  successFg: '#0A6B4A',
  successStrong: '#0E8A5F',
  white: '#FFFFFF',
  black: '#0B0B0D',
};

export const radii = {
  sm: 8,
  md: 10,
  lg: 12,
  xl: 14,
  xxl: 16,
  xxxl: 20,
  pill: 999,
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
};

export const fonts = {
  regular: 'PlusJakartaSans_400Regular',
  medium: 'PlusJakartaSans_500Medium',
  semibold: 'PlusJakartaSans_600SemiBold',
  bold: 'PlusJakartaSans_700Bold',
  extrabold: 'PlusJakartaSans_800ExtraBold',
};

export const shadow = {
  card: {
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  sheet: {
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 50,
    shadowOffset: { width: 0, height: 20 },
    elevation: 8,
  },
};
