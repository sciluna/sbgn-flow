import path from 'path';
import webpack from 'webpack';
const __dirname = path.resolve();

export default {
  mode: 'development',
  entry: './app/js/main.js',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: "bundle.js",
    library: {
      type: 'umd'
    }
  },
  resolve: {
    alias: { util$: path.resolve(__dirname, 'node_modules/util'),
      process$: path.resolve(__dirname, 'node_modules/process')
    },
    fallback: {
      "fs": false,
      "http": false,
      "timers": false,
      "url": false,
      "stream": false,
      "https": false,
      "child_process": false,
      "util": 'util',
      "process": 'process',
      "string_decoder": false
    } 
  },
  plugins: [
    new webpack.ProvidePlugin({
      process: 'process/browser', // Provide process as a global variable
    }),
  ],
  module: {
    rules: [
      {
        test: /\.(?:js|mjs|cjs)$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
          options: {
            targets: "defaults",
            presets: [
              ['@babel/preset-env']
            ]
          }
        }
      }
    ]
  }
};