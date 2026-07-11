declare global {
  namespace NodeJS {
    interface ProcessEnv {
      NEXT_PUBLIC_CHOOSEE_API_BASE_URL: string
      NEXT_PUBLIC_COGNITO_APP_CLIENT_ID: string
      NEXT_PUBLIC_COGNITO_DOMAIN: string
      NEXT_PUBLIC_COGNITO_USER_POOL_ID: string
      NEXT_PUBLIC_DELAY_BETWEEN_REFRESH_MS: string
      NEXT_PUBLIC_IDENTITY_POOL_ID: string
      NEXT_PUBLIC_ORIGIN: string
      NEXT_PUBLIC_RECAPTCHA_SITE_KEY: string
    }
  }
}

export {}
