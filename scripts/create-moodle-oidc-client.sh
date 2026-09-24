#!/bin/bash

# Create a dedicated Keycloak OIDC client for Moodle (Confidential + Authorization Code flow)
#
# Usage:
#   KEYCLOAK_URL=http://localhost:8080 \
#   KEYCLOAK_ADMIN_USERNAME=admin \
#   KEYCLOAK_ADMIN_PASSWORD=admin \
#   KEYCLOAK_REALM=startupvarsity \
#   MOODLE_CLIENT_ID=moodle \
#   MOODLE_REDIRECT_URI="https://learn.example.com/admin/oauth2callback.php" \
#   MOODLE_WEB_ORIGIN="https://learn.example.com" \
#   ./scripts/create-moodle-oidc-client.sh

set -euo pipefail

KEYCLOAK_URL="${KEYCLOAK_URL:-http://localhost:8080}"
ADMIN_USER="${KEYCLOAK_ADMIN_USERNAME:-admin}"
ADMIN_PASSWORD="${KEYCLOAK_ADMIN_PASSWORD:-admin}"
REALM_NAME="${KEYCLOAK_REALM:-startupvarsity}"

MOODLE_CLIENT_ID="${MOODLE_CLIENT_ID:-moodle}"
MOODLE_REDIRECT_URI="${MOODLE_REDIRECT_URI:-}"
MOODLE_WEB_ORIGIN="${MOODLE_WEB_ORIGIN:-}"

if [[ -z "$MOODLE_REDIRECT_URI" ]]; then
  echo "❌ MOODLE_REDIRECT_URI is required"
  echo "   Example: https://learn.rooman.com/admin/oauth2callback.php"
  exit 1
fi

if [[ -z "$MOODLE_WEB_ORIGIN" ]]; then
  echo "❌ MOODLE_WEB_ORIGIN is required"
  echo "   Example: https://learn.rooman.com"
  exit 1
fi

echo "🔧 Creating Keycloak client for Moodle..."
echo "   Keycloak: $KEYCLOAK_URL"
echo "   Realm:    $REALM_NAME"
echo "   Client:   $MOODLE_CLIENT_ID"
echo "   Redirect: $MOODLE_REDIRECT_URI"
echo "   Origin:   $MOODLE_WEB_ORIGIN"
echo ""

# Get admin access token
TOKEN_RESPONSE=$(curl -s -X POST "$KEYCLOAK_URL/realms/master/protocol/openid-connect/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "username=$ADMIN_USER" \
  -d "password=$ADMIN_PASSWORD" \
  -d "grant_type=password" \
  -d "client_id=admin-cli")

ACCESS_TOKEN=$(echo "$TOKEN_RESPONSE" | grep -o '"access_token":"[^"]*' | cut -d'"' -f4)

if [[ -z "$ACCESS_TOKEN" ]]; then
  echo "❌ Failed to get admin access token."
  echo "   Check Keycloak is running and admin credentials are correct."
  exit 1
fi

# Create client (idempotent: 409 if already exists)
CREATE_STATUS=$(curl -s -w "%{http_code}" -o /tmp/moodle_client_create.txt -X POST "$KEYCLOAK_URL/admin/realms/$REALM_NAME/clients" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "clientId": "'$MOODLE_CLIENT_ID'",
    "name": "Moodle LMS",
    "description": "Moodle OAuth2/OIDC client",
    "enabled": true,
    "protocol": "openid-connect",
    "publicClient": false,
    "standardFlowEnabled": true,
    "implicitFlowEnabled": false,
    "directAccessGrantsEnabled": false,
    "serviceAccountsEnabled": false,
    "redirectUris": [
      "'$MOODLE_REDIRECT_URI'"
    ],
    "webOrigins": [
      "'$MOODLE_WEB_ORIGIN'"
    ]
  }')

if [[ "$CREATE_STATUS" == "201" ]]; then
  echo "✅ Client created"
elif [[ "$CREATE_STATUS" == "409" ]]; then
  echo "ℹ️  Client already exists (will reuse)"
else
  echo "❌ Client creation failed (HTTP $CREATE_STATUS)"
  cat /tmp/moodle_client_create.txt
  rm -f /tmp/moodle_client_create.txt
  exit 1
fi

# Get client UUID
CLIENT_UUID=$(curl -s -X GET "$KEYCLOAK_URL/admin/realms/$REALM_NAME/clients?clientId=$MOODLE_CLIENT_ID" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  | grep -o '"id":"[^"]*' | head -1 | cut -d'"' -f4)

if [[ -z "$CLIENT_UUID" ]]; then
  echo "❌ Failed to fetch client UUID"
  rm -f /tmp/moodle_client_create.txt
  exit 1
fi

# Fetch client secret
CLIENT_SECRET=$(curl -s -X GET "$KEYCLOAK_URL/admin/realms/$REALM_NAME/clients/$CLIENT_UUID/client-secret" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  | grep -o '"value":"[^"]*' | cut -d'"' -f4)

if [[ -z "$CLIENT_SECRET" ]]; then
  echo "❌ Failed to fetch client secret"
  rm -f /tmp/moodle_client_create.txt
  exit 1
fi

ISSUER="$KEYCLOAK_URL/realms/$REALM_NAME"

echo ""
echo "=============================================="
echo "✅ SHARE THESE WITH THE MOODLE TEAM"
echo "=============================================="
echo "Keycloak Base URL:            $KEYCLOAK_URL"
echo "Realm Name:                  $REALM_NAME"
echo "Issuer (recommended):        $ISSUER"
echo "OpenID Configuration URL:    $ISSUER/.well-known/openid-configuration"
echo "Authorization Endpoint:      $ISSUER/protocol/openid-connect/auth"
echo "Token Endpoint:              $ISSUER/protocol/openid-connect/token"
echo "Userinfo Endpoint:           $ISSUER/protocol/openid-connect/userinfo"
echo "JWKS URL:                    $ISSUER/protocol/openid-connect/certs"
echo ""
echo "Client ID:                   $MOODLE_CLIENT_ID"
echo "Client Secret:               $CLIENT_SECRET"
echo "Allowed Redirect URI:        $MOODLE_REDIRECT_URI"
echo ""

rm -f /tmp/moodle_client_create.txt
