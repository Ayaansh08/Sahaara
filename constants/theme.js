// Sahaara Elder-Care Theme Tokens (Extracted from Login Screen)

export const COLORS = {
  // Brand & Accent Colors
  primary: '#C85A32',        // Warm Terracotta / Saffron
  primaryLight: '#F5EBE1',   // Light Warm Terracotta Tint
  primaryFocused: '#FFFDFB', // Focused input background
  primaryDisabled: '#E5D6C7',// Disabled button background

  // Surfaces & Backgrounds
  background: '#F8F4EC',     // Warm Ivory / Light Beige
  surface: '#FFFFFF',        // Pure White Card Background
  surfaceSecondary: '#FAF6EE',// Light Cream Card Background
  surfaceMuted: '#F3EDE4',   // Muted Disabled Surface

  // Typography Colors
  textPrimary: '#3E2723',    // Dark Warm Brown
  textDark: '#2C1D11',       // Extra Dark Brown
  textSecondary: '#7C685B',  // Muted Warm Brown
  textSubtle: '#6E5A4D',     // Subtitle Brown
  textLight: '#99877A',      // Placeholder Light Brown
  textOnPrimary: '#FFFDF7',  // Off-white on Terracotta

  // Borders
  border: '#EFE5D8',         // Warm Card Border
  borderInput: '#E8D9C9',    // Input Field Border
  borderFocused: '#C85A32',  // Terracotta Focus Border

  // Status & Feedback Colors
  positive: '#4A7C59',       // Muted Sage Green
  positiveLight: '#F0F8F2',  // Light Green Banner
  positiveBorder: '#C6E5CE', // Soft Green Border

  error: '#C94A4A',          // Soft Red Error
  errorLight: '#FFF0F0',     // Light Red Error Banner
  errorBorder: '#F5C6C6',    // Soft Red Border

  sosRed: '#C94A4A',         // Muted Emergency Alert Red
  sosRedLight: '#FFF5F5',    // SOS Modal Light Background
};

export const TYPOGRAPHY = {
  mainHeading: {
    fontSize: 28,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  cardTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  bodyText: {
    fontSize: 18,
    fontWeight: '500',
    color: COLORS.textDark,
  },
  buttonText: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.textOnPrimary,
  },
  secondaryText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  captionText: {
    fontSize: 15,
    fontWeight: '500',
    color: COLORS.textSubtle,
  },
};

export const SIZES = {
  minTouchHeight: 58,        // Senior-friendly minimum tappable height
  cardRadius: 24,            // Senior-friendly rounded card radius
  buttonRadius: 16,          // Button corner radius
  inputRadius: 16,           // Input corner radius
  iconLarge: 32,             // Primary icon size
  iconNormal: 24,            // Standard icon size
};

export const SPACING = {
  xs: 6,
  sm: 10,
  md: 16,
  lg: 24,
  xl: 32,
};
