module.exports = {
  root: true,
  extends: ['next/core-web-vitals', 'next/typescript'],
  settings: {
    next: {
      rootDir: ['apps/admin'],
    },
  },
  rules: {
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
  },
};
