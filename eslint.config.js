import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: ['node_modules/**', 'output/**', 'dist/**', 'coverage/**', 'eslint.config.js'],
  },
  js.configs.recommended,
  tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // TypeScript resout deja les identifiants : no-undef ne produit que des faux positifs.
      'no-undef': 'off',
    },
  },
  prettier,
);
