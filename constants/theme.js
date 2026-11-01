// constants/theme.js
// Sahaara design tokens — "Kanjeevaram maroon"
// Silk maroon, temple gold, bottle green on warm paper.
// Built for older eyes: large type, high contrast, big touch targets, no shadows.

// ---------------------------------------------------------------------------
// COLOR
// ---------------------------------------------------------------------------
export const colors = {
  // Surfaces
  paper: '#FAF3E3',        // screen background (cream)
  paperDeep: '#F0E3C6',    // cards, input fields, unselected mood
  line: '#D6C08F',         // borders and dividers (2px)

  // Text
  ink: '#2A1417',          // main text (never pure black)
  inkSoft: '#5A3F42',      // supporting text (still AAA on paper, never lighter than this)
  onPrimary: '#FAF3E3',    // text on maroon buttons / hero text

  // Brand
  primary: '#7A1F2B',      // main buttons, hero bg, active elements
  primaryPressed: '#5F1721',
  heroBg: '#7A1F2B',       // maroon hero background
  heroText: '#FAF3E3',     // cream text on maroon
  gold: '#C9962B',         // decoration only: small bars, zari, arch borders
  goldLight: '#E8CF8E',    // light gold for date on hero & active tab
  lightGold: '#E8CF8E',
  goldText: '#7A5509',     // when gold-toned text is needed (passes contrast on paper)
  zari: '#C9962B',         // gold zari border

  // Calm / wellness / success
  calm: '#1F5C4D',
  forest: '#1F5C4D',         // bottle green: bhajan, selected mood, success states
  calmSoft: '#DCE8DF',     // light green wash behind calm elements

  // Tab Bar
  tabBarBg: '#7A1F2B',     // maroon tab bar
  tabActive: '#E8CF8E',    // light gold for active tab icon & label
  tabInactive: '#FAF3E3',  // cream for inactive tab icon & label

  // Emergency and errors
  sos: '#C62828',
  crimson: '#C62828',          // reserved for SOS only
  sosPressed: '#9E1F1F',
  onSos: '#FFFFFF',
  sosWhite: '#FFFFFF',     // white SOS pill on maroon hero
  dangerText: '#A31F1F',   // error messages on paper
  dangerSoft: '#F7DADA',   // error banner background
};

// ---------------------------------------------------------------------------
// TYPOGRAPHY
// Fonts: Fraunces (English headings), NotoSerifDevanagari (Hindi headings), Mukta (body both langs)
// Load in app/_layout.js with useFonts(fontMap)
// ---------------------------------------------------------------------------

export const fonts = {
  en: {
    heading:       'Fraunces_700Bold',
    headingMedium: 'Fraunces_600SemiBold',
  },
  hi: {
    heading:       'NotoSerifDevanagari_700Bold',
    headingMedium: 'NotoSerifDevanagari_600SemiBold',
  },
  // Mukta covers both Latin and Devanagari — body text is shared
  body:        'Mukta_500Medium',
  bodyStrong:  'Mukta_600SemiBold',
  button:      'Mukta_700Bold',
};

import {
  Fraunces_600SemiBold,
  Fraunces_700Bold,
} from '@expo-google-fonts/fraunces';
import {
  NotoSerifDevanagari_600SemiBold,
  NotoSerifDevanagari_700Bold,
} from '@expo-google-fonts/noto-serif-devanagari';
import {
  Mukta_500Medium,
  Mukta_600SemiBold,
  Mukta_700Bold,
} from '@expo-google-fonts/mukta';

export const fontMap = {
  Fraunces_600SemiBold,
  Fraunces_700Bold,
  NotoSerifDevanagari_600SemiBold,
  NotoSerifDevanagari_700Bold,
  Mukta_500Medium,
  Mukta_600SemiBold,
  Mukta_700Bold,
};

// type-scale — minimum 18 (tab labels 15-16), body 20, Hindi gets extra lineHeight so matras never clip
const scale = {
  display:        { size: 40, line: 48, hiLine: 64, family: 'heading' },
  greeting:       { size: 32, line: 40, hiLine: 54, family: 'heading' },
  title:          { size: 32, line: 40, hiLine: 54, family: 'heading' },
  sectionHeading: { size: 22, line: 30, hiLine: 40, family: 'headingMedium' },
  heading:        { size: 28, line: 36, hiLine: 48, family: 'headingMedium' },
  subheading:     { size: 24, line: 32, hiLine: 42, family: 'headingMedium' },
  bodyLarge:      { size: 22, line: 32, hiLine: 42, family: 'body' },
  body:           { size: 20, line: 30, hiLine: 40, family: 'body' },
  bodyStrong:     { size: 20, line: 30, hiLine: 40, family: 'bodyStrong' },
  label:          { size: 18, line: 26, hiLine: 36, family: 'bodyStrong' },
  button:         { size: 22, line: 28, hiLine: 38, family: 'button' },
  tabLabel:       { size: 16, line: 20, hiLine: 22, family: 'bodyStrong' },
};

/**
 * Usage: <Text style={textStyle('title', lang)}>...</Text>
 * lang is 'hi' or 'en'
 */
export function textStyle(role = 'body', lang = 'en', color = colors.ink) {
  const s = scale[role] || scale.body;
  const isHeadingFamily = s.family === 'heading' || s.family === 'headingMedium';
  const fontFamily = isHeadingFamily
    ? fonts[lang === 'hi' ? 'hi' : 'en'][s.family]
    : fonts[s.family];
  return {
    fontFamily,
    fontSize: s.size,
    lineHeight: lang === 'hi' ? s.hiLine : s.line,
    color,
  };
}

// ---------------------------------------------------------------------------
// SPACING, SHAPE, SIZES
// ---------------------------------------------------------------------------
export const spacing = {
  xs: 8,
  sm: 12,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
  screenX: 20, // horizontal screen padding
};

export const radius = {
  hero: 0,        // Hero block has square sides and no radius
  card: 16,
  row: 16,        // Buttons and colored rows 16px
  button: 16,     // Buttons 16px
  input: 16,
  pill: 999,
  archBottom: 10, // Arch bottom corners 10px
};

export const border = {
  width: 2,
  archWidth: 3,
  color: colors.line,
  goldColor: colors.gold,
};

export const sizes = {
  touchMin:     56,   // no tappable thing smaller than this
  button:       64,   // main button height
  buttonSmall:  56,
  input:        60,
  icon:         28,
  iconLarge:    40,
  tabBarHeight: 80,
  tabIcon:      28,
  tabLabel:     16,
  sosHero:      56,   // White SOS pill on maroon hero (56px tall)
  sos:          40,   // Generic SOS pill (alias used in ScreenHeader)
  sosCream:     48,   // Red SOS pill on cream screens
  moodCircle:   64,   // Mood buttons 64px circles
};

// ---------------------------------------------------------------------------
// COMPONENT PRESETS
// ---------------------------------------------------------------------------
export const presets = {
  screen: {
    flex: 1,
    backgroundColor: colors.paper,
  },

  // Color-block rows (Bhajan / Wellness)
  colorBlockRow: {
    minHeight: 72,
    borderRadius: radius.row,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
  },

  // Hero block: square sides, no radius
  heroBlock: {
    backgroundColor: colors.heroBg,
    width: '100%',
    paddingHorizontal: spacing.screenX,
  },

  buttonPrimary: {
    backgroundColor: colors.primary,
    minHeight: sizes.button,
    borderRadius: radius.button,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  buttonPrimaryPressed: { backgroundColor: colors.primaryPressed },

  tabBar: {
    backgroundColor: colors.tabBarBg,
    borderTopWidth: 0,
    height: sizes.tabBarHeight,
    paddingTop: 8,
    paddingBottom: 8,
  },
  tabActiveTint:   colors.tabActive,
  tabInactiveTint: colors.tabInactive,
};

export const motion = {
  fast: 120,
  base: 200,
};

// Legacy compatibility mapping
export const COLORS = {
  primary:         colors.primary,
  primaryLight:    colors.paperDeep,
  primaryFocused:  colors.paper,
  primaryDisabled: colors.paperDeep,
  background:      colors.paper,
  surface:         colors.paperDeep,
  surfaceSecondary:colors.paper,
  surfaceMuted:    colors.paperDeep,
  textPrimary:     colors.ink,
  textDark:        colors.ink,
  textSecondary:   colors.inkSoft,
  textSubtle:      colors.inkSoft,
  textLight:       colors.inkSoft,
  textOnPrimary:   colors.onPrimary,
  border:          colors.line,
  borderInput:     colors.line,
  borderFocused:   colors.primary,
  positive:        colors.calm,
  positiveLight:   colors.calmSoft,
  positiveBorder:  colors.calmSoft,
  error:           colors.dangerText,
  errorLight:      colors.dangerSoft,
  errorBorder:     colors.dangerSoft,
  sosRed:          colors.sos,
  sosRedLight:     colors.dangerSoft,
  gold:            colors.gold,
  calm:            colors.calm,
  calmSoft:        colors.calmSoft,
};

export const SIZES = {
  minTouchHeight: sizes.touchMin,
  cardRadius:     radius.card,
  buttonRadius:   radius.button,
  inputRadius:    radius.input,
  iconLarge:      sizes.iconLarge,
  iconNormal:     sizes.icon,
};

export const SPACING = {
  xs: spacing.xs,
  sm: spacing.sm,
  md: spacing.md,
  lg: spacing.lg,
  xl: spacing.xl,
  xxl: spacing.xxl,
};

const theme = { colors, fonts, fontMap, textStyle, spacing, radius, border, sizes, presets, motion, COLORS, SIZES, SPACING };
export default theme;
