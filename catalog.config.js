/*
 * Copyright 2018 Teralytics
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 */

// module.exports = {
//     webpack: (catalogWebpackConfig, { paths, useBabelrc }) => {
//     catalogWebpackConfig.resolve.extensions.push(".ts", ".tsx");
//
//     const babelLoader = {
//       loader: "babel-loader",
//       options: {
//         babelrc: useBabelrc,
//         presets: useBabelrc ? [] : ["babel-preset-react-app", "catalog/babel"],
//         cacheDirectory: true
//       }
//     };
//
//     catalogWebpackConfig.module.rules.unshift({
//       test: /\.(ts|tsx)$/,
//       include: [paths.appRoot, paths.catalogSrcDir],
//       exclude: /node_modules/,
//       use: [
//         babelLoader,
//         {
//           loader: "ts-loader",
//           options: {}
//         }
//       ]
//     });
//
//     return catalogWebpackConfig;
//   }
// };

// module.exports = {
//   webpack: (catalogWebpackConfig, {}) => {
//     catalogWebpackConfig.resolve = {
//       extensions: ['.ts', '.tsx', '.js', '.jsx', '.json']
//     }
//     catalogWebpackConfig.module.rules.unshift(
//       {
//         test: /\.tsx?$/,
//         loader: 'awesome-typescript-loader',
//         exclude: /node_modules/,
//       }
//     )
//     return catalogWebpackConfig
//   }
// }


module.exports = {
  webpack: (catalogWebpackConfig, { paths }) => {
    catalogWebpackConfig.resolve.extensions.push(".ts", ".tsx");
    catalogWebpackConfig.module.rules.unshift(
      {
        test: /\.tsx?$/,
        loader: 'awesome-typescript-loader',
        include: [paths.appRoot, paths.catalogSrcDir],
        exclude: /node_modules/,
      }
    )
    return catalogWebpackConfig
  }
}
