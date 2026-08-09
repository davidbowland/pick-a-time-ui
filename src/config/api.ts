// The API base URL. Deliberately NOT in config/amplify.ts: every module that imports that one
// executes Amplify.configure and pulls the Cognito client into its chunk, and this app's requests
// go through plain fetch (see the comment at the top of services/api.ts). Reading a single env var
// should not cost the landing page 78 KB of auth library.
export const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL
