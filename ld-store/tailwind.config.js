/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{vue,js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      // 莫兰迪色系配色
      colors: {
        // 主色调 - 莫兰迪灰粉色系
        morandi: {
          50: '#faf9f7',
          100: '#f5f3f0',
          200: '#ebe7e1',
          300: '#ddd7ce',
          400: '#c9c0b3',
          500: '#b5a898',
          600: '#9f8f7d',
          700: '#857565',
          800: '#6b5d50',
          900: '#544941',
        },
        // 柔和绿色
        sage: {
          50: '#f6f7f4',
          100: '#e8ebe3',
          200: '#d4dac9',
          300: '#b8c2a7',
          400: '#9aa886',
          500: '#7d8d69',
          600: '#627151',
          700: '#4d5842',
          800: '#404838',
          900: '#363d30',
        },
        // 莫兰迪蓝
        dusty: {
          50: '#f5f7f8',
          100: '#e8edf0',
          200: '#d5dde2',
          300: '#b8c6ce',
          400: '#94a9b5',
          500: '#778d9c',
          600: '#627684',
          700: '#52616c',
          800: '#47525b',
          900: '#3e464e',
        },
        // 玫瑰灰
        rose: {
          50: '#faf8f8',
          100: '#f4efef',
          200: '#ebe2e2',
          300: '#dccece',
          400: '#c5afaf',
          500: '#ad9090',
          600: '#937474',
          700: '#7a5f5f',
          800: '#665050',
          900: '#574545',
        },
        // 暖金色
        warm: {
          50: '#fdfbf7',
          100: '#f9f5eb',
          200: '#f2e8d4',
          300: '#e8d5b4',
          400: '#dcbe8f',
          500: '#cfa76f',
          600: '#bd8d57',
          700: '#9e7149',
          800: '#805c40',
          900: '#6a4d37',
        },
      },
      fontFamily: {
        sans: [
          '-apple-system',
          'BlinkMacSystemFont',
          '"Segoe UI"',
          'Roboto',
          '"Helvetica Neue"',
          'Arial',
          '"PingFang SC"',
          '"Microsoft YaHei"',
          'sans-serif',
        ],
      },
      boxShadow: {
        'soft': '0 2px 15px -3px rgba(0, 0, 0, 0.07), 0 10px 20px -2px rgba(0, 0, 0, 0.04)',
        'card': '0 1px 3px rgba(0, 0, 0, 0.05), 0 1px 2px rgba(0, 0, 0, 0.1)',
        'hover': '0 4px 20px -2px rgba(0, 0, 0, 0.1), 0 2px 8px -1px rgba(0, 0, 0, 0.06)',
      },
      borderRadius: {
        'xl': '1rem',
        '2xl': '1.25rem',
        '3xl': '1.5rem',
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'slide-down': 'slideDown 0.3s ease-out',
        'scale-in': 'scaleIn 0.2s ease-out',
        'spin-slow': 'spin 2s linear infinite',
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
        slideDown: {
          '0%': { opacity: '0', transform: 'translateY(-10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        scaleIn: {
          '0%': { opacity: '0', transform: 'scale(0.95)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
      },
    },
  },
  plugins: [],
}
