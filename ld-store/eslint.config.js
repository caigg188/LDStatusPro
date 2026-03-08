import js from '@eslint/js'
import globals from 'globals'
import pluginVue from 'eslint-plugin-vue'

const appFiles = ['src/**/*.{js,vue}']
const toolFiles = [
  'eslint.config.js',
  'vite.config.js',
  'postcss.config.js',
  'tailwind.config.js',
  'scripts/**/*.js'
]

export default [
  {
    ignores: ['dist/**', 'node_modules/**', '.wrangler/**', 'public/**']
  },
  {
    ...js.configs.recommended,
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module'
    }
  },
  ...pluginVue.configs['flat/essential'],
  {
    files: appFiles,
    languageOptions: {
      globals: {
        ...globals.browser
      }
    },
    rules: {
      // 现阶段先确保基础问题可见，但不因历史包袱阻塞迭代
      'no-unused-vars': [
        'warn',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^(_|error|e)$'
        }
      ],
      'vue/multi-word-component-names': 'off'
    }
  },
  {
    files: toolFiles,
    languageOptions: {
      globals: {
        ...globals.node
      }
    }
  }
]
