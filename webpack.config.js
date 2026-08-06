const path = require('path');
const webpack = require('webpack');
const { VueLoaderPlugin } = require('vue-loader');

module.exports = {
	entry: {
		'hufak-main': './src/main.ts',
	},
	output: {
		path: path.resolve(__dirname, 'js'),
		filename: '[name].js',
		// the student stats app is React and is only pulled in on demand
		chunkFilename: 'hufak-[name].js',
		clean: false,
	},
	module: {
		rules: [
			{
				test: /\.vue$/,
				use: 'vue-loader',
			},
			{
				test: /\.css$/,
				use: ['style-loader', 'css-loader', 'postcss-loader'],
			},
			{
				test: /\.[jt]sx?$/,
				exclude: /node_modules/,
				use: {
					loader: 'babel-loader',
					options: {
						presets: [
							['@babel/preset-env', { targets: 'defaults' }],
							['@babel/preset-react', { runtime: 'automatic' }],
						],
						overrides: [
							{
								test: /\.tsx$/,
								presets: [['@babel/preset-typescript', { isTSX: true, allExtensions: true }]],
							},
							{
								test: /\.ts$/,
								presets: ['@babel/preset-typescript'],
							},
							{
								// script blocks vue-loader extracts keep the .vue filename,
								// so babel needs to be told they are TypeScript
								test: /\.vue$/,
								presets: [['@babel/preset-typescript', { allExtensions: true }]],
							},
						],
					},
				},
			},
		],
	},
	plugins: [
		new VueLoaderPlugin(),
		new webpack.DefinePlugin({
			// @nextcloud/vue components are written with the options API
			__VUE_OPTIONS_API__: 'true',
			__VUE_PROD_DEVTOOLS__: 'false',
			__VUE_PROD_HYDRATION_MISMATCH_DETAILS__: 'false',
			// the embedded Vite apps read their asset base from import.meta.env,
			// which webpack does not provide; the mount modules set the global
			'import.meta.env.BASE_URL': 'window.__hufakAssetBase__',
		}),
	],
	resolve: {
		extensions: ['.ts', '.tsx', '.js', '.jsx', '.vue'],
	},
};
