module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    // Enterprise-friendly rules
    'subject-case': [2, 'always', ['sentence-case']], // Only sentence-case (natural)
    'subject-max-length': [2, 'always', 72], // Max 72 chars for subject
    'body-max-line-length': [2, 'always', 100], // Max 100 chars per line in body
    'subject-empty': [2, 'never'], // Subject is required
    'type-empty': [2, 'never'], // Type is required
    'type-enum': [
      2,
      'always',
      [
        'build',     // Build system changes
        'chore',     // Maintenance tasks
        'ci',        // CI/CD changes
        'docs',      // Documentation
        'feat',      // New features
        'fix',       // Bug fixes
        'perf',      // Performance improvements
        'refactor',  // Code refactoring
        'revert',    // Revert commits
        'security',  // Security fixes
        'style',     // Code style changes
        'test'       // Test changes
      ]
    ],
    // Enterprise traceability
    'references-empty': [1, 'never'], // Warn if no issue references
    'scope-case': [2, 'always', 'lower-case'], // Scope should be lowercase
    'scope-enum': [
      1, // Warning level
      'always',
      [
        // Core modules from src/modules/
        'auth',
        'users',
        'profiles',
        'wallets', 
        'blockchains',
        'withdrawals',
        'loans',
        'beneficiaries',
        'institutions',
        'sms',
        'accounts',
        'notifications',
        // Infrastructure
        'api',
        'db',
        'config',
        'shared',
        'test',
        'deps',
        'scripts',
        'docker'
      ]
    ]
  }
};
