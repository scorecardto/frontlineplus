require('webpack');

const path = require('path');
const fs = require('fs');
const CopyPlugin = require('copy-webpack-plugin');
const {glob} = require('glob');
const src = path.join(__dirname, '..', 'src');

const add = (folder) => {
  const files = fs.readdirSync(path.join(src, folder));
  const result = {};
  for (const file of files) {
    result[`${folder}/${file}/${file}`] = path.join(src, `${folder}/${file}/${file}.ts`);
  }
  return result;
};

module.exports = {
  entry: {
    css: glob.sync(`${src}/**/*.css`),
    popup: glob.sync(`${src}/popup/**/*.tsx`),
    background: path.join(src, 'background.ts'),
    ...add('inject'),
  },
  output: {
    path: path.join(__dirname, '../dist'),
    filename: '[name].js',
  },
  optimization: {
    splitChunks: {
      name: 'vendor',
      chunks(chunk) {
        return chunk.name !== 'background';
      },
    },
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: 'ts-loader',
        exclude: /node_modules/,
      },
      {
        test: /\.css?$/gi,
        include: path.join(src, 'popup'),
        use: ['style-loader', 'css-loader'],
      },
      {
        test: /\.css?$/gi,
        include: path.join(src, 'inject'),
        use: ['css-loader'],
      },
    ],
  },
  resolve: {
    extensions: ['.ts', '.tsx', '.js'],
  },
  plugins: [
    new CopyPlugin({
      patterns: [{from: '.', to: '../dist', context: 'public'}],
      options: {},
    }),
    new CopyPlugin({
      patterns: [{from: './inject/**/*.css', to: '../dist', context: 'src'}],
    }),
  ],
};
