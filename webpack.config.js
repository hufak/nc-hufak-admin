const path = require('path');

module.exports = {
	entry: {
		'hufak-main': './src/main.jsx',
	},
	output: {
		path: path.resolve(__dirname, 'js'),
		filename: '[name].js',
		clean: false,
	},
	module: {
		rules: [
			{
				test: /\.jsx?$/,
				exclude: /node_modules/,
				use: {
					loader: 'babel-loader',
				},
			},
		],
	},
	resolve: {
		extensions: ['.js', '.jsx'],
	},
};
