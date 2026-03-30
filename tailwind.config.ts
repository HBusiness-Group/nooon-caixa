import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        nooon: {
          dark:    '#0d1410',
          dark2:   '#111a14',
          dark3:   '#172010',
          dark4:   '#1e2a18',
          dark5:   '#243020',
          deep:    '#1a5c2a',
          mid:     '#2a7a3a',
          lime:    '#6dd400',
          lime2:   '#85e81a',
        },
      },
      fontFamily: {
        barlow: ['Barlow', 'sans-serif'],
        condensed: ['Barlow Condensed', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
    },
  },
  plugins: [],
}

export default config
