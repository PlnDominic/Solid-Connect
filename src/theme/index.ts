import { Platform } from 'react-native';

/**
 * DIRECTION CONTRACT - Solid Connect redesign
 *
 * THESIS: Trust reads as a receipt, not a rating. Refuses the default
 * trust-marketplace arrangement (soft cards, star badges, cheerful
 * illustration) for the one interface Ghana already trusts with money.
 *
 * OWN-WORLD: Near-monochrome white ground (near-black ink), one
 * confirmation green reserved exclusively for verified/paid/confirmed
 * states, plus a matching pending-amber and declined-brick-red on the same
 * "reserved, never decorative" discipline. A second reserved accent, the
 * brand orange from the logo, marks active selection (picked filter,
 * picked category, active tab) - distinct from confirm-green's job.
 * Numerals and reference codes set
 * in platform monospace (Menlo/Roboto Mono); everything else in Inter,
 * standing in for one consistent system-adjacent face across iOS and
 * Android. Cards read as receipts/statements - ruled hairlines, stamped
 * confirmation marks, transaction-reference rows - never soft illustrated
 * tiles. Depth comes from hairline rules, not glow shadows; real elevation
 * is reserved for genuinely floating layers (sheets, modals).
 *
 * STORY: A customer sees a provider's verification the way they'd see a
 * mobile-money payment confirm: unambiguous, numbered, stamped. A provider
 * sees their own credentials rendered the same way. Both trust it instantly
 * - they've trusted this exact pattern with their money for years.
 *
 * FORM: Assigned direction (index 3 of 7 grounded candidates, "MoMo
 * Confirmation Language"), seed key 6df9c973. Locked by the user over
 * "Verified Trade Card" (own top pick) and "Metro Line" transit-diagram
 * (competitive external challenger). Raised with disciplines borrowed from
 * declined challengers: state changes carry a distinct mark/stamp, never
 * color alone; one signature "reveal" gesture, not scattered micro-motion;
 * the accent is reserved strictly for confirmed/verified moments.
 *
 * FINISH: unreviewed and undocumented is unfinished; this build ends with
 * the finish review, the verdict, and DESIGN.md.
 */

export const colors = {
  // White ground - the page background is plain white, not warm/beige paper.
  paper: '#FFFFFF',
  paperDim: '#F2F2F1',
  card: '#FFFFFF',

  // Ink - warm near-black, not a cold gray-black.
  ink: '#15181A',
  inkMuted: 'rgba(21,24,26,0.62)',
  inkFaint: 'rgba(21,24,26,0.42)',
  inkFainter: 'rgba(21,24,26,0.26)',

  // Hairline rules do the separation work that shadows do elsewhere.
  hairline: '#E3E3E1',
  hairlineStrong: '#CBCBC7',

  // The one accent - reserved exclusively for confirmed / verified / paid.
  confirm: '#0E6B45',
  confirmDeep: '#0A4F34',
  confirmBg: '#E6F1EA',

  // Same reservation discipline, for the other two functional states.
  pending: '#8A5A00',
  pendingBg: '#FBF1DD',
  danger: '#9A2E22',
  dangerBg: '#F8E9E5',

  // Lighter variants of the two accent states, for use on the ink-dark
  // hero card only - the base tones don't carry enough contrast there.
  confirmOnDark: '#3FBE85',
  pendingOnDark: '#F0B429',

  // Brand orange (from the Solid Connect logo) - reserved for "active"
  // selection state: the picked filter, the picked category, the active
  // tab. A second reserved accent alongside confirm-green, not a
  // decorative color; still never used for plain body chrome.
  active: '#F27511',
  activeDeep: '#C85A08',

  // Deep navy - used for the "Solid Connect" hero card background on Home,
  // and as the brand accent on onboarding/login (Button's "navy" variant).
  navy: '#13284A',
  navyBg: '#E9EDF3',

  white: '#FFFFFF',
  black: '#0B0B0A',

  // Legacy aliases kept only so screens outside this redesign's scope
  // (provider/chat/jobs, etc.) keep compiling until they're carried
  // through in a follow-up pass. Do not reach for these in new work.
  orange: '#F27511',
  orangeDeep: '#C85A08',
  bg: '#FFFFFF',
  surface: '#FFFFFF',
  tile: '#F2F2F1',
  tileBorder: '#E3E3E1',
  hairlineSoft: '#F2F2F1',
  inputBorder: '#E3E3E1',
  textPrimary: '#15181A',
  textHeading: '#15181A',
  textBody: 'rgba(21,24,26,0.62)',
  textMuted: 'rgba(21,24,26,0.62)',
  textFaint: 'rgba(21,24,26,0.42)',
  textDim: 'rgba(21,24,26,0.26)',
  successBg: '#E6F1EA',
  successFg: '#0A4F34',
  successStrong: '#0E6B45',
};

// Flatter, more rectangular - a ruled document, not a bubble app.
export const radii = {
  sm: 4,
  md: 6,
  lg: 8,
  xl: 10,
  xxl: 12,
  xxxl: 16,
  pill: 999,
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
};

export const fonts = {
  // Inter stands in for one consistent system-adjacent face across iOS and
  // Android (Operate mode: a workhorse UI face, not a display face with a
  // point of view - the discipline ios.md asks of SF Pro).
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
  extrabold: 'Inter_800ExtraBold',
  // Reference codes, amounts, dates and timestamps - the receipt's numeric
  // voice. Platform monospace, not a downloaded display mono.
  mono: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }) as string,
};

export const shadow = {
  // Reserved for genuinely floating layers only (sheets, modals) - in-flow
  // content separates with a hairline, never a shadow standing in for one.
  sheet: {
    shadowColor: '#0B0B0A',
    shadowOpacity: 0.16,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 12 },
    elevation: 10,
  },
  // Legacy alias for screens outside this pass's scope.
  card: {
    shadowColor: '#0B0B0A',
    shadowOpacity: 0,
    shadowRadius: 0,
    shadowOffset: { width: 0, height: 0 },
    elevation: 0,
  },
};
