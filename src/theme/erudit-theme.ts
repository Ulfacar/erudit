import { createTheme, MantineColorsTuple } from '@mantine/core';

const eruditBlue: MantineColorsTuple = [
  '#e5f0ff',
  '#cddcfb',
  '#9bb5f1',
  '#658ce8',
  '#3969e0',
  '#228be6',
  '#0d49da',
  '#003bc2',
  '#0034ae',
  '#002c9a',
];

const eruditPink: MantineColorsTuple = [
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

export const eruditTheme = createTheme({
  primaryColor: 'eruditBlue',
  colors: {
    eruditBlue,
    eruditPink,
  },

  fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif',
  headings: {
    fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif',
    fontWeight: '700',
  },

  defaultRadius: 'md',
});
