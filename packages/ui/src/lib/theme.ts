// Single source of truth for all brand colors.
// Import from here — never hardcode hex in components.
export const theme = {
  colors: {
    brand: {
      primary: "#5B8DEF",        // Steel Blue — operator panel default; overridden per institution
      primaryLight: "#7BA3F3",
      primaryDark: "#4A7ADE",
      primaryDeep: "#3968C7",
      primaryHover: "#6B97F1",
      primaryLightHover: "#8BB0F5",
      accent: "#5B8DEF",
      accentLight: "#7BA3F3",
    },
    status: {
      success: "#34d399",
      successGlow: "rgba(52, 211, 153, 0.12)",
      warning: "#f97316",
      error: "#ef4444",
      info: "#5B8DEF",
      neutral: "#706f70",
    },
    ui: {
      borderBeamFrom: "#5B8DEF",
      borderBeamTo: "#3968C7",
      spotlight: "rgba(255, 255, 255, 0.25)",
      starBorder: "rgba(91, 141, 239, 0.8)",
      gridBorder: "rgba(91, 141, 239, 0.08)",
      gridHover: "rgba(91, 141, 239, 0.03)",
      vignetteLight: "#ebedf1",
      vignetteLightTransparent: "rgba(235, 237, 241, 0)",
      vignetteDark: "#080808",
      vignetteDarkTransparent: "rgba(8, 8, 8, 0)",
    },
    glow: {
      accent06: "rgba(91,141,239,0.06)",
      accent08: "rgba(91,141,239,0.08)",
      accent15: "rgba(91,141,239,0.15)",
      accent25: "rgba(91,141,239,0.25)",
      accent50: "rgba(91,141,239,0.50)",
    },
    text: {
      muted: "#acadb1",
      secondary: "#706f70",
      dark: "#353536",
      white: "#ebedf1",
    },
    grey: {
      50: "#ebedf1",
      100: "#d4d8df",
      200: "#acadb1",
      300: "#706f70",
      400: "#353536",
      500: "#080808",
    },
  },
  shadows: {
    brandGlow: "0 0 6px rgba(91, 141, 239, 0.5)",
    glowSm: "0 0 20px rgba(91, 141, 239, 0.3)",
    glowLg: "0 0 40px rgba(91, 141, 239, 0.5), 0 0 80px rgba(91, 141, 239, 0.15)",
    accentGlowXs: "0 0 6px rgba(91,141,239,0.4)",
    accentGlowSm: "0 0 12px rgba(91,141,239,0.08)",
    accentGlowMd: "0 0 16px rgba(91,141,239,0.25)",
    cardHover: "0 25px 50px -12px rgba(0,0,0,0.25), 0 0 0 1px rgba(91,141,239,0.1)",
  },
  gradients: {
    brand: ["#5B8DEF", "#7BA3F3", "#4A7ADE", "#3968C7", "#5B8DEF"],
    brandText: ["#5B8DEF", "#7BA3F3", "#4A7ADE"],
  },
} as const;
