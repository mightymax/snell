var $path = require("path");

module.exports = {
  mode: "production",

  devtool: "source-map",

  entry: {
    index: "./src/index.js"
  },

  output: {
    path: $path.join(__dirname, "public/javascripts/Snell"),
    filename: "[name].js",
    chunkFilename: "[name].js"
  },

  module: {
    rules: [{
      test: /\.js$/,
      include: /node_modules/,
      use: {
        loader: "babel-loader",
        options: {
          presets: ["@babel/preset-env"],
          plugins: ["@babel/plugin-syntax-dynamic-import"]
        }
      }
    }, {
      test: /.js$/,
      use: ["source-map-loader"],
      enforce: "pre"
    }]
  },

  externals: function ({context, request}, callback) {
    if (/xlsx|canvg|pdfmake/.test(request)) {
      return callback(null, "commonjs " + request);
    }
    callback();
  }
};