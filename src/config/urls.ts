// The production origin, hardcoded.
//
// This is NOT `NEXT_PUBLIC_ORIGIN`, and the difference is the whole point of this file. That
// variable is environment-aware -- it resolves to https://pick-a-time.bowland.link in the test
// deploy -- which is correct for `config/amplify.ts`, where the Cognito redirect has to come back
// to the host the visitor is actually on, and wrong for anything a crawler reads.
//
// The same build ships byte for byte to both hosts, so the test deploy served a full crawlable copy
// of every public page. Built from `NEXT_PUBLIC_ORIGIN`, its canonical pointed at itself, which does
// not merely fail to name production -- a self-referential canonical on a duplicate is a positive
// claim that the duplicate IS the original, and it is the strongest signal on the page.
//
// So: anything a crawler reads (canonical, og:url, og:image) uses this. Anything the running app
// needs about its own host keeps using NEXT_PUBLIC_ORIGIN.
export const siteUrl = 'https://pick-a-time.com'
export const ogImageUrl = `${siteUrl}/og-image.png`
