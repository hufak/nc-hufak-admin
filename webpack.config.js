const path = require('path');

module.exports = {
	entry: {
		'hufak-main': './src/main.tsx',
	},
	output: {
		path: path.resolve(__dirname, 'js'),
		filename: '[name].js',
		clean: false,
	},
	module: {
		rules: [
			{
				test: /\.[jt]sx?$/,
				exclude: /node_modules/,
				use: {
					loader: 'babel-loader',
					options: {
						presets: [
							['@babel/preset-env', { targets: 'defaults' }],
							['@babel/preset-react', { runtime: 'automatic' }],
							'@babel/preset-typescript',
						],
					},
				},
			},
		],
	},
	resolve: {
		extensions: ['.ts', '.tsx', '.js', '.jsx'],
	},
};
