module.exports = function (api) {
  api.cache(true);

  return {
    presets: ['babel-preset-expo'],
    plugins: [
      [
        'module-resolver',
        {
          extensions: ['.ts', '.tsx', '.js', '.jsx', '.json'],
          alias: {
            '@': './src',
            '@domain': '../../packages/domain/src',
            '@platform': '../../packages/platform/src',
            '@shared': '../../packages/shared/src',
            '@engine': '../../packages/game-engine/src',
          },
        },
      ],
      '@babel/plugin-transform-class-static-block',
      'react-native-reanimated/plugin',
    ],
  };
};
