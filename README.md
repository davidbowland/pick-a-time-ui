# choosee-ui

Next.js and Amplify implementation of choosee-session-api and choosee-infrastructure. Example: <https://choosee.dbowland.com/>

## Static Site

### Prerequisites

1. [Node](https://nodejs.org/en/)
1. [NPM](https://www.npmjs.com/)

### Local Development

The Next.js development server automatically rerenders in the browser when the source code changes. Start the local development server with:

```bash
npm run start
```

Alternatively, run a production build and serve that static content with:

```bash
npm run serve
```

Then view the server at <http://localhost:3000/>

### Unit Tests

[Jest](https://jestjs.io/) tests are run automatically on commit and push. If the test coverage threshold is not met, the push will fail. See `jest.config.ts` for coverage threshold.

Manually run tests with:

```bash
npm run test
```

### Prettier / Linter

Both [Prettier](https://prettier.io/) and [ESLint](https://eslint.org/) are executed on commit. Manually prettify and lint code with:

```bash
npm run lint
```

### Deploying to Production

This project automatically deploys to production when a merge to `master` is made via a pull request.

## Deploy Script

In extreme cases, the UI can be deployed with:

```bash
npm run deploy
```

The `developer` role and [AWS SAM CLI](https://aws.amazon.com/serverless/sam/) are required to deploy this project.
