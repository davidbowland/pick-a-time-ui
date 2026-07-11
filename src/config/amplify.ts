import { Amplify } from 'aws-amplify'
// Side-effect import: registers the OAuth listener that detects ?code=
// on the callback page and exchanges it for tokens with Cognito.
import 'aws-amplify/auth/enable-oauth-listener'

const origin = process.env.NEXT_PUBLIC_ORIGIN
const baseUrl = process.env.NEXT_PUBLIC_CHOOSEE_API_BASE_URL

// API endpoint names used by services/api.ts
export const apiName = 'ChooseeAPI'
export const apiNameUnauthenticated = 'ChooseeAPIUnauthenticated'

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
  API: {
    REST: {
      [apiName]: {
        endpoint: baseUrl!,
        region: process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID.split('_')[0],
      },
      [apiNameUnauthenticated]: {
        endpoint: baseUrl!,
        region: process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID.split('_')[0],
      },
    },
  },
})
