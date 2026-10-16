import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  // Build output and agent worktrees (full repo copies) aren't source.
  globalIgnores(['dist', 'api/dist', 'mcp/dist', '.claude', 'ios']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    rules: {
      // Routes strip client-owned fields with `const { id, userId, ...rest } = req.body`;
      // an underscore marks a parameter kept for its position.
      '@typescript-eslint/no-unused-vars': ['error', {
        ignoreRestSiblings: true,
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_',
      }],
      // `declare global { namespace Express { … } }` is how Express's Request is augmented.
      '@typescript-eslint/no-namespace': ['error', { allowDeclarations: true }],
    },
  },
])
