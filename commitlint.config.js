/** @type {import('@commitlint/types').UserConfig} */
module.exports = {
  extends: ["@commitlint/config-conventional"],
  rules: {
    // Keep subject line concise
    "header-max-length": [2, "always", 100],
    // Allow common commit types
    "type-enum": [
      2,
      "always",
      [
        "feat", // New feature
        "fix", // Bug fix
        "docs", // Documentation only
        "style", // Code style (formatting, semicolons, etc)
        "refactor", // Code refactoring
        "perf", // Performance improvement
        "test", // Adding or updating tests
        "build", // Build system or dependencies
        "ci", // CI/CD configuration
        "chore", // Maintenance tasks
        "revert", // Revert a commit
      ],
    ],
  },
};
