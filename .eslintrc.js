module.exports = {
  extends: 'next/core-web-vitals',
  overrides: [
    {
      files: ['*.stories.tsx'],
      rules: {
        'import/no-anonymous-default-export': 'off',
      },
    },
  ],
}
