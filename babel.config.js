module.exports = function (api) {
  api.cache(true);
  const plugins = [];
  
  if (process.env.INSTRUMENT_COVERAGE === 'true') {
    plugins.push([
      'istanbul',
      {
        exclude: [
          '**/*.spec.ts',
          'e2e/**',
          'src/__tests__/**',
          'src/lib/__tests__/**',
          'node_modules/**'
        ]
      }
    ]);
  }

  return {
    presets: ['next/babel'],
    plugins
  };
};
