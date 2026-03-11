import type { Request, Response } from "express";

/**
 * MCP OAuth 2.0 Authorization Server Metadata (RFC 8414)
 *
 * Returns metadata that delegates to Google OAuth2 endpoints.
 * Claude Code discovers this at /.well-known/oauth-authorization-server
 * and uses it to drive the OAuth flow, sending the resulting Google
 * access token as Bearer to /mcp.
 */
export function handleOAuthMetadata(req: Request, res: Response) {
  const issuer = getIssuer(req);

  res.json({
    issuer,
    authorization_endpoint: `${issuer}/oauth/authorize`,
    token_endpoint: `${issuer}/oauth/token`,
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    code_challenge_methods_supported: ["S256"],
    scopes_supported: [
      "openid",
      "email",
      "profile",
      "https://www.googleapis.com/auth/drive.file",
    ],
  });
}

/**
 * OAuth authorize endpoint — redirects to Google OAuth2.
 * Passes through all standard OAuth params (client_id, redirect_uri, etc.)
 * but forces the scopes we need for Drive access.
 */
export function handleOAuthAuthorize(req: Request, res: Response) {
  const params = new URLSearchParams();

  // Pass through standard OAuth params from Claude Code
  const passthrough = [
    "response_type",
    "client_id",
    "redirect_uri",
    "state",
    "code_challenge",
    "code_challenge_method",
  ];
  for (const key of passthrough) {
    const val = (req.query[key] as string) || "";
    if (val) params.set(key, val);
  }

  // Use our Google client ID
  params.set("client_id", process.env.GOOGLE_CLIENT_ID!);

  // Force required scopes
  params.set(
    "scope",
    "openid email profile https://www.googleapis.com/auth/drive.file"
  );
  params.set("access_type", "offline");
  params.set("prompt", "consent");

  res.redirect(
    `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`
  );
}

/**
 * OAuth token endpoint — proxies to Google's token endpoint.
 * Claude Code sends the authorization code here; we forward to Google
 * and return the tokens.
 */
export async function handleOAuthToken(req: Request, res: Response) {
  const body = req.body as Record<string, string>;

  const params = new URLSearchParams();
  params.set("grant_type", body.grant_type || "authorization_code");
  if (body.code) params.set("code", body.code);
  if (body.redirect_uri) params.set("redirect_uri", body.redirect_uri);
  if (body.refresh_token) params.set("refresh_token", body.refresh_token);
  if (body.code_verifier) params.set("code_verifier", body.code_verifier);

  // Use our Google credentials
  params.set("client_id", process.env.GOOGLE_CLIENT_ID!);
  params.set("client_secret", process.env.GOOGLE_CLIENT_SECRET!);

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });

  const data = await tokenRes.json();
  res.status(tokenRes.status).json(data);
}

function getIssuer(req: Request): string {
  const proto = req.headers["x-forwarded-proto"] || req.protocol;
  const host = req.headers["x-forwarded-host"] || req.headers.host;
  return `${proto}://${host}`;
}
