# Moodle OAuth2/OIDC with Keycloak (StartupVarsity)

This repo currently integrates **StartupVarsity → Keycloak** as an OIDC *client*.
To integrate **Moodle → Keycloak**, Moodle also needs its own OIDC client in Keycloak.

## What this achieves

- Users authenticate with Keycloak.
- Moodle trusts Keycloak and logs users in via OAuth2/OIDC.
- If the user already has a Keycloak session (because they logged into StartupVarsity via Keycloak), Moodle login becomes seamless.

## What you need from the Moodle (LMS) team

- Moodle base URL (example: `https://learn.rooman.com`)
- Moodle OAuth2 callback/redirect URI (example: `https://learn.rooman.com/admin/oauth2callback.php`)
- Confirmation of user matching/mapping (usually email, first name, last name)

## Keycloak endpoints to share

Given:
- Keycloak Base URL: `https://YOUR_KEYCLOAK_HOST`
- Realm: `startupvarsity`

Issuer:
- `https://YOUR_KEYCLOAK_HOST/realms/startupvarsity`

Endpoints:
- Authorization: `/protocol/openid-connect/auth`
- Token: `/protocol/openid-connect/token`
- Userinfo: `/protocol/openid-connect/userinfo`
- JWKS: `/protocol/openid-connect/certs`
- Discovery: `/.well-known/openid-configuration`

## Create the Moodle client in Keycloak (automated)

1) Make sure Keycloak is running.

2) Run:

```bash
KEYCLOAK_URL=http://localhost:8080 \
KEYCLOAK_ADMIN_USERNAME=admin \
KEYCLOAK_ADMIN_PASSWORD=admin \
KEYCLOAK_REALM=startupvarsity \
MOODLE_CLIENT_ID=moodle \
MOODLE_REDIRECT_URI="https://learn.rooman.com/admin/oauth2callback.php" \
MOODLE_WEB_ORIGIN="https://learn.rooman.com" \
./scripts/create-moodle-oidc-client.sh
```

3) Send the printed **Client ID**, **Client Secret**, and endpoints to the Moodle team.

## Notes

- `localhost` is only for local testing. Moodle’s hosted server cannot reach `http://localhost:8080` on your laptop.
- For real integration, Keycloak must be reachable via a real hostname + HTTPS.

## StartupVarsity: "Start Learning" redirect

The Learning Hub button opens `GET /api/lms/start` on the StartupVarsity server.

Configure one of the following:

- `MOODLE_OAUTH2_START_URL` (full URL to Moodle’s OAuth2 login entrypoint, recommended)
	- Example: `https://learn.rooman.com/auth/oauth2/`
- OR `MOODLE_BASE_URL` (StartupVarsity will redirect to `${MOODLE_BASE_URL}/auth/oauth2/`)
	- Example: `https://learn.rooman.com`
