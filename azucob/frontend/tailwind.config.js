/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Azuton brand colors with namespace
        azuton: {
          primary: '#0066CC',
          secondary: '#004C99',
          accent: '#00AAFF',
          dark: '#1A1A2E',
          light: '#F5F7FA',
          success: '#00C853',
          warning: '#FFB300',
          danger: '#FF3D00',
        },
        // Aliases for easier usage (bg-primary, text-dark, etc.)
        primary: '#0066CC',
        secondary: '#004C99',
        accent: '#00AAFF',
        dark: '#1A1A2E',
        light: '#F5F7FA',
        success: '#00C853',
        warning: '#FFB300',
        danger: '#FF3D00',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['Poppins', 'Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        'card': '0 4px 6px -1px rgba(0, 102, 204, 0.1), 0 2px 4px -1px rgba(0, 102, 204, 0.06)',
        'card-hover': '0 10px 15px -3px rgba(0, 102, 204, 0.15), 0 4px 6px -2px rgba(0, 102, 204, 0.1)',
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
}
