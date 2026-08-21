"use client";
import { createTheme } from "@mui/material/styles";

// Surfaces are outlined rather than elevated so light and dark mode share one visual language.
// Per-component defaults live here; pages should not restyle buttons, cards, or headings.
const theme = createTheme({
  cssVariables: {
    colorSchemeSelector: "data",
  },
  // WCAG AA: MUI computes contrastText against this threshold (default 3 is below AA).
  palette: { contrastThreshold: 4.5 },
  colorSchemes: {
    light: {
      palette: {
        primary: { main: "#2563eb", light: "#60a5fa", dark: "#1e40af" },
        secondary: { main: "#7c3aed", light: "#a78bfa", dark: "#5b21b6" },
        success: { main: "#15803d" },
        background: { default: "#f8fafc", paper: "#ffffff" },
        divider: "#e2e8f0",
      },
    },
    // Dark mode keeps MUI's neutral grey surfaces (#121212 / #1e1e1e) so the blue primary
    // and the flow accent colors stay distinct from the background.
    dark: {
      palette: {
        primary: { main: "#60a5fa", light: "#93c5fd", dark: "#2563eb" },
        secondary: { main: "#a78bfa", light: "#c4b5fd", dark: "#7c3aed" },
        success: { main: "#4ade80" },
      },
    },
  },
  typography: {
    fontFamily: 'var(--font-inter), "Roboto", "Helvetica", "Arial", sans-serif',
    h4: { fontWeight: 700, fontSize: "1.75rem" },
    h5: { fontWeight: 600, fontSize: "1.25rem" },
    h6: { fontWeight: 600, fontSize: "1.05rem" },
    button: { textTransform: "none", fontWeight: 600 },
  },
  shape: {
    borderRadius: 10,
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: (theme) => ({
        // Plain anchors come from rendered markdown. MUI components always carry a class.
        "a:not([class]), a:not([class]):visited": {
          color: theme.vars.palette.primary.main,
        },
        code: {
          fontFamily: '"JetBrains Mono", "Fira Code", ui-monospace, SFMono-Regular, Menlo, monospace',
          fontSize: "0.875em",
          padding: "0.1em 0.4em",
          borderRadius: 4,
          backgroundColor: theme.vars.palette.action.hover,
        },
      }),
    },
    MuiButton: {
      defaultProps: { disableElevation: true },
    },
    MuiCard: {
      defaultProps: { variant: "outlined" },
    },
    MuiCardContent: {
      styleOverrides: {
        root: { padding: 24, "&:last-child": { paddingBottom: 24 } },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: { backgroundImage: "none" },
      },
    },
    MuiAppBar: {
      defaultProps: { color: "inherit", elevation: 0 },
      styleOverrides: {
        root: ({ theme }) => ({
          borderBottom: `1px solid ${theme.vars.palette.divider}`,
        }),
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: ({ theme }) => ({
          borderRight: `1px solid ${theme.vars.palette.divider}`,
        }),
      },
    },
    MuiListItemButton: {
      styleOverrides: {
        root: ({ theme }) => ({
          borderRadius: theme.shape.borderRadius,
          "&.Mui-selected": {
            backgroundColor: `rgba(${theme.vars.palette.primary.mainChannel} / 0.12)`,
            color: theme.vars.palette.primary.main,
            "& .MuiListItemIcon-root": { color: theme.vars.palette.primary.main },
            "&:hover": {
              backgroundColor: `rgba(${theme.vars.palette.primary.mainChannel} / 0.18)`,
            },
          },
        }),
      },
    },
    MuiListSubheader: {
      styleOverrides: {
        root: ({ theme }) => ({
          backgroundColor: "transparent",
          lineHeight: "32px",
          marginTop: theme.spacing(1),
          fontSize: "0.75rem",
          fontWeight: 600,
          letterSpacing: "0.04em",
          textTransform: "uppercase",
        }),
      },
    },
    MuiChip: {
      styleOverrides: {
        root: { fontWeight: 500 },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        head: ({ theme }) => ({
          fontWeight: 600,
          color: theme.vars.palette.text.secondary,
          backgroundColor: theme.vars.palette.background.default,
        }),
      },
    },
  },
});

export default theme;
