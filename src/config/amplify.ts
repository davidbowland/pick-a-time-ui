import { Amplify } from 'aws-amplify'
// Side-effect import: registers the OAuth listener that detects ?code=
// on the callback page and exchanges it for tokens with Cognito.
import 'aws-amplify/auth/enable-oauth-listener'

const origin = process.env.NEXT_PUBLIC_ORIGIN

// Every request in services/api.ts hangs off this. Amplify's REST client is deliberately not
// configured here -- see the comment at the top of services/api.ts.
export const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL

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
