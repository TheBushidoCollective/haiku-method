import { AuthorizeClient } from "./AuthorizeClient"

// The haikumethod.ai broker's `/cli/start` points the CLI's verification_url
// here: /oauth/cli/authorize?provider=&host=&state=&authorize_via=. This page
// kicks off the provider OAuth (reusing the registered /auth/{provider}/callback/
// redirect) carrying the broker `state`, so the callback can hand the exchanged
// token back to the broker's /cli/complete. Client-only (static export).
export default function CliAuthorizePage() {
	return <AuthorizeClient />
}
