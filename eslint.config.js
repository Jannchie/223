import jannchie from '@jannchie/eslint-config'

export default jannchie({ unocss: false, ignores: ['public/**/*', 'dist/**/*', 'dist-electron/**/*'], rules: { 'no-console': 'off', 'unicorn/no-array-reverse': 'off', 'unicorn/prefer-dom-node-remove': 'off' } })
