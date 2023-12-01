const path = require('path')

module.exports = (env) => {
  const isProduction = env.production

  return {
    mode: isProduction ? 'production' : 'development',
    entry: './src/index.ts',
    output: {
      filename: 'bundle.js',
      path: path.resolve(__dirname, isProduction ? 'lib' : 'dist'),
      library: 'createBlackboard',
      libraryTarget: 'umd', // UMD 형식으로 라이브러리를 번들링
      globalObject: 'this', // UMD 라이브러리에서의 전역 객체 설정
      clean: true,
    },
    module: {
      rules: [
        {
          test: /\.ts$/,
          use: [
            {
              loader: 'babel-loader',
              options: {
                presets: ['@babel/preset-env'], // ECMAScript 기능 변환
              },
            },
            isProduction
              ? {
                  loader: 'ts-loader',
                  options: {
                    compilerOptions: {
                      declaration: true,
                    },
                  },
                }
              : 'ts-loader',
          ],
          exclude: /node_modules|\.stories\.ts(x)?$/,
        },
      ],
    },
    resolve: {
      extensions: ['.ts', '.js'],
    },
    devtool: isProduction ? false : 'inline-source-map',
  }
}
