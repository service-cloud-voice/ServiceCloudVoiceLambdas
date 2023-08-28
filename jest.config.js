module.exports = {
	//  collectCoverage: false, // Only collect in CI
	collectCoverageFrom: ['lambdas/**/*.js', 'lambdas/**/*.test.js'],
	coverageDirectory: './.coverage',
	coverageThreshold: {
		global: {
			branches: 90,
			functions: 90,
			lines: 90,
			statements: 90,
		},
	},
	coverageReporters: ['json', 'clover'],
	moduleFileExtensions: ['js'],
	transform: {
		'^.+\\.js$': 'babel-jest',
	},
	verbose: true,
	silent: true,
	testURL: 'http://localhost/',
	json: true,
};
