import nextJest from 'next/jest.js'

const createJestConfig = nextJest({ dir: './' })

/** @type {import('jest').Config} */
const config = {
  clearMocks: true,
  collectCoverage: true,
  collectCoverageFrom: ['src/**/*'],
  coverageDirectory: 'coverage',
  coveragePathIgnorePatterns: [
    '.*\\.d\\.ts',
    'config/*',
    'types.ts',
    'pages/_app.tsx',
    'pages/_document.tsx',
    'pages/auth/*',
    'hooks/useAuth.ts',
    'components/auth-context/*',
  ],
  coverageThreshold: {
    global: { branches: 80, functions: 90, lines: 90 },
  },
  moduleNameMapper: {
    '.+\\.(css|styl|less|sass|scss)$': 'identity-obj-proxy',
    '.+\\.(jpg|jpeg|png|gif|eot|otf|webp|svg|ttf|woff|woff2|mp4|webm|wav|mp3|m4a|aac|oga|pdf|yaml)$':
      '<rootDir>/__mocks__/file-mock.js',
    '^@components/(.*)$': '<rootDir>/src/components/$1',
    '^@config/(.*)$': '<rootDir>/src/config/$1',
    '^@fontsource(-variable)?/(.*)$': '<rootDir>/__mocks__/file-mock.js',
    '^@heroui/react$': '<rootDir>/node_modules/@heroui/react/dist/index.js',
    '^@heroui/styles$': '<rootDir>/node_modules/@heroui/styles/dist/index.js',
    '^@hooks/(.*)$': '<rootDir>/src/hooks/$1',
    '^@pages/(.*)$': '<rootDir>/src/pages/$1',
    '^@services/(.*)$': '<rootDir>/src/services/$1',
    '^@test/(.*)$': '<rootDir>/test/$1',
    '^@types$': '<rootDir>/src/types',
    '^@utils/(.*)$': '<rootDir>/src/utils/$1',
  },
  setupFiles: ['<rootDir>/jest.polyfills.js', '<rootDir>/jest.setup-test-env.js'],
  testEnvironment: 'jsdom',
  testEnvironmentOptions: {
    customExportConditions: [''],
  },
  testPathIgnorePatterns: ['node_modules', '\\.cache', '<rootDir>.*/out'],
}

// next/jest prepends its own transformIgnorePatterns that block all node_modules.
// We override them after resolution to allow ESM packages to be transformed.
// If tests fail with "SyntaxError: Unexpected token 'export'", add the failing package name here.
const esmPackages = [
  'uuid',
  '@heroui',
  'tailwind-variants',
  '@jridgewell',
  '@react-aria',
  '@react-stately',
  '@react-types',
  'react-aria-components',
  '@internationalized',
  'input-otp',
  '@radix-ui',
  'tailwind-merge',
  'dedent',
  'embla-carousel',
].join('|')

const baseCreateJestConfig = createJestConfig(config)

export default async function jestConfig() {
  const resolvedConfig = await baseCreateJestConfig()
  return {
    ...resolvedConfig,
    transformIgnorePatterns: [`/node_modules/(?!(${esmPackages})/)`, '^.+\\.module\\.(css|sass|scss)$'],
  }
}
