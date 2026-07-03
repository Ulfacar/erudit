import { createTheme, MantineColorsTuple } from '@mantine/core';

/**
 * Bilim OS design tokens — aligned with new design (Claude Design, May 2026)
 * Brand: #228be6 (blue-600), cool grays, Inter font
 */

const bilimosBlue: MantineColorsTuple = [
  '#e7f5ff', // 50
  '#d0ebff', // 100
  '#a5d8ff', // 200
  '#74c0fc', // 300
  '#4dabf7', // 400
  '#339af0', // 500
  '#228be6', // 600 — primary
  '#1c7ed6', // 700
  '#1971c2', // 800
  '#1864ab', // 900
];

const bilimosPink: MantineColorsTuple = [
  '#ffe5f3',
  '#fccde2',
  '#f39ac2',
  '#eb64a0',
  '#e43884',
  '#e91e8c',
  '#df0969',
  '#c60058',
  '#b1004e',
  '#9c0042',
];

export const bilimosTheme = createTheme({
  primaryColor: 'bilimosBlue',
  colors: {
    bilimosBlue,
    bilimosPink,
  },

  fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif",
  headings: {
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif",
    fontWeight: '700',
  },

  defaultRadius: 'md',

  shadows: {
    xs: '0 1px 2px rgba(15, 23, 42, 0.04)',
    sm: '0 1px 3px rgba(15, 23, 42, 0.06), 0 1px 2px rgba(15, 23, 42, 0.04)',
    md: '0 4px 12px rgba(15, 23, 42, 0.06), 0 2px 4px rgba(15, 23, 42, 0.04)',
    lg: '0 12px 28px rgba(15, 23, 42, 0.10), 0 4px 10px rgba(15, 23, 42, 0.06)',
    xl: '0 20px 40px rgba(15, 23, 42, 0.12), 0 8px 16px rgba(15, 23, 42, 0.08)',
  },

  other: {
    // Design tokens for custom components
    surfaceBorder: '#e6e9ee',
    surfaceBg: '#f8f9fb',
    textSecondary: '#6b7280',
  },

  components: {
    Paper: {
      defaultProps: {
        shadow: 'xs',
      },
    },
    Card: {
      defaultProps: {
        shadow: 'xs',
      },
    },
    Button: {
      styles: {
        root: {
          fontWeight: 600,
        },
      },
    },
    Table: {
      styles: {
        thead: {
          '& th': {
            fontSize: '12px',
            fontWeight: 600,
            textTransform: 'uppercase' as const,
            letterSpacing: '0.04em',
            color: '#6b7280',
          },
        },
      },
    },
    NavLink: {
      styles: {
        root: {
          borderRadius: '8px',
          fontWeight: 500,
          '&[dataActive]': {
            backgroundColor: '#e7f5ff',
            color: '#1864ab',
          },
        },
      },
    },
  },
});
