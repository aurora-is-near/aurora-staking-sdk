module.exports = {
  reporters: ['default', 'github-actions'],
  clearMocks: true,
  preset: 'ts-jest/presets/js-with-babel',
  testPathIgnorePatterns: ['/dist/', '/node_modules/'],
  modulePathIgnorePatterns: ['/dist/'],
};
