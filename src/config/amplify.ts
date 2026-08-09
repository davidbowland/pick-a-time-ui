import { Amplify } from 'aws-amplify'
// Side-effect import: registers the OAuth listener that detects ?code=
// on the callback page and exchanges it for tokens with Cognito.
import 'aws-amplify/auth/enable-oauth-listener'

const origin = process.env.NEXT_PUBLIC_ORIGIN

Amplify.configure({
  Auth: {
    Cognito: {
      userPoolId: process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID,
      userPoolClientId: process.env.NEXT_PUBLIC_COGNITO_APP_CLIENT_ID,
      loginWith: {
        oauth: {
          domain: process.env.NEXT_PUBLIC_COGNITO_DOMAIN,
          scopes: ['openid', 'email', 'profile'],
          redirectSignIn: [`${origin}/auth/callback/`],
          redirectSignOut: [`${origin}/`],
          responseType: 'code',
          providers: ['Google'],
        },
      },
    },
  },
})

// Re-exported here, rather than imported from 'aws-amplify/auth' at each call site, so that
// reaching the auth functions requires evaluating this module -- which means Amplify.configure has
// already run above. That ordering is a convention, not a language guarantee, so eslint.config.mjs
// fences 'aws-amplify' imports to this file.
//
// Everything else reaches these through the memoized dynamic import in services/auth.ts. Importing
// this module statically pulls the whole Cognito client into the importer's chunk, which is the
// cost this indirection exists to keep off the landing page.
export { fetchAuthSession, getCurrentUser, signInWithRedirect, signOut } from 'aws-amplify/auth'
export { Hub } from 'aws-amplify/utils'
