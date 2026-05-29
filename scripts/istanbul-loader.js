const { createInstrumenter } = require('istanbul-lib-instrument');

const instrumenter = createInstrumenter({
  compact: false,
  produceSourceMap: true,
  autoWrap: true,
  esModules: true,
  parserPlugins: [
    'typescript',
    'jsx',
    'decorators-legacy',
    'classProperties',
    'objectRestSpread',
    'dynamicImport',
    'optionalChaining',
    'nullishCoalescingOperator',
  ],
});

module.exports = function (source, map) {
  // Check if we should instrument this file
  const filepath = this.resourcePath;

  // Ignore node_modules, non-JS/TS files, and layout/landing page because of next/font
  if (
    filepath.includes('node_modules') ||
    !/\.(js|jsx|ts|tsx)$/.test(filepath) ||
    filepath.endsWith('layout.tsx') ||
    filepath.endsWith('LandingPage.tsx')
  ) {
    return this.callback(null, source, map);
  }

  try {
    // Instrument the source code
    const instrumented = instrumenter.instrumentSync(source, filepath, map);
    const lastSourceMap = instrumenter.lastSourceMap();
    return this.callback(null, instrumented, lastSourceMap);
  } catch (err) {
    // If instrumentation fails, log a warning and return the original code
    console.warn(`[istanbul-loader] Failed to instrument: ${filepath}`, err);
    return this.callback(null, source, map);
  }
};
