#!/bin/bash

# Keycloak Setup Script for StartupVarsity SSO
# This script automatically configures Keycloak with the required realm and clients

set -e

KEYCLOAK_URL="http://localhost:8080"
ADMIN_USER="admin"
ADMIN_PASSWORD="admin"
REALM_NAME="startupvarsity"
CLIENT_ID="startupvarsity-app"

echo "🔧 Setting up Keycloak for StartupVarsity SSO..."
echo ""

# Wait for Keycloak to be ready
echo "⏳ Waiting for Keycloak to be ready..."
for i in {1..30}; do
  if curl -s "$KEYCLOAK_URL" > /dev/null 2>&1; then
    echo "✅ Keycloak is ready!"
    break
  fi
  echo "   Attempt $i/30: Keycloak not ready yet, waiting..."
  sleep 2
done

# Get admin access token
echo ""
echo "🔐 Getting admin access token..."
TOKEN_RESPONSE=$(curl -s -X POST "$KEYCLOAK_URL/realms/master/protocol/openid-connect/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "username=$ADMIN_USER" \
  -d "password=$ADMIN_PASSWORD" \
  -d "grant_type=password" \
  -d "client_id=admin-cli")

ACCESS_TOKEN=$(echo $TOKEN_RESPONSE | grep -o '"access_token":"[^"]*' | cut -d'"' -f4)

if [ -z "$ACCESS_TOKEN" ]; then
  echo "❌ Failed to get access token. Make sure Keycloak is running and credentials are correct."
  exit 1
fi

echo "✅ Got access token"

# Create realm
echo ""
echo "🌍 Creating realm: $REALM_NAME..."
REALM_CREATE=$(curl -s -w "%{http_code}" -o /tmp/realm_response.txt -X POST "$KEYCLOAK_URL/admin/realms" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"realm\": \"$REALM_NAME\",
    \"enabled\": true,
    \"displayName\": \"StartupVarsity\",
    \"loginTheme\": \"keycloak\",
    \"sslRequired\": \"none\",
    \"registrationAllowed\": false,
    \"rememberMe\": true,
    \"resetPasswordAllowed\": true
  }")

if [ "$REALM_CREATE" == "201" ] || [ "$REALM_CREATE" == "409" ]; then
  echo "✅ Realm '$REALM_NAME' created or already exists"
else
  echo "⚠️  Realm creation returned status: $REALM_CREATE"
  cat /tmp/realm_response.txt
fi

# Create client
echo ""
echo "📱 Creating client: $CLIENT_ID..."
CLIENT_CREATE=$(curl -s -w "%{http_code}" -o /tmp/client_response.txt -X POST "$KEYCLOAK_URL/admin/realms/$REALM_NAME/clients" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "clientId": "'$CLIENT_ID'",
    "name": "StartupVarsity Application",
    "description": "Main StartupVarsity web application",
    "enabled": true,
    "publicClient": false,
    "protocol": "openid-connect",
    "standardFlowEnabled": true,
    "implicitFlowEnabled": false,
    "directAccessGrantsEnabled": true,
    "serviceAccountsEnabled": false,
    "redirectUris": [
      "http://localhost:5000/*",
      "http://localhost:5000/api/auth/callback",
      "http://localhost:5432/*",
      "http://localhost:5432/api/auth/callback"
    ],
    "webOrigins": [
      "http://localhost:5000",
      "http://localhost:5432"
    ],
    "attributes": {
      "pkce.code.challenge.method": "S256"
    }
  }')

if [ "$CLIENT_CREATE" == "201" ] || [ "$CLIENT_CREATE" == "409" ]; then
  echo "✅ Client '$CLIENT_ID' created or already exists"
else
  echo "⚠️  Client creation returned status: $CLIENT_CREATE"
  cat /tmp/client_response.txt
fi

# Get client UUID (needed to fetch secret)
echo ""
echo "🔍 Fetching client details..."
CLIENT_UUID=$(curl -s -X GET "$KEYCLOAK_URL/admin/realms/$REALM_NAME/clients?clientId=$CLIENT_ID" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  | grep -o '"id":"[^"]*' | head -1 | cut -d'"' -f4)

if [ -z "$CLIENT_UUID" ]; then
  echo "❌ Failed to get client UUID"
  exit 1
fi

echo "✅ Client UUID: $CLIENT_UUID"

# Get client secret
echo ""
echo "🔑 Fetching client secret..."
CLIENT_SECRET=$(curl -s -X GET "$KEYCLOAK_URL/admin/realms/$REALM_NAME/clients/$CLIENT_UUID/client-secret" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  | grep -o '"value":"[^"]*' | cut -d'"' -f4)

if [ -z "$CLIENT_SECRET" ]; then
  echo "❌ Failed to get client secret"
  exit 1
fi

# Display results
echo ""
echo "=============================================="
echo "✅ KEYCLOAK SETUP COMPLETE!"
echo "=============================================="
echo ""
echo "📋 Add these to your .env file:"
echo ""
echo "KEYCLOAK_ISSUER=http://localhost:8080/realms/$REALM_NAME"
echo "KEYCLOAK_CLIENT_ID=$CLIENT_ID"
echo "KEYCLOAK_CLIENT_SECRET=$CLIENT_SECRET"
echo "KEYCLOAK_REDIRECT_URI=http://localhost:5000/api/auth/callback"
echo ""
echo "=============================================="
echo ""
echo "🌐 Access Keycloak Admin Console:"
echo "   URL: http://localhost:8080/admin"
echo "   Username: admin"
echo "   Password: admin"
echo ""
echo "🔗 Realm: http://localhost:8080/admin/master/console/#/$REALM_NAME"
echo ""

# Cleanup
rm -f /tmp/realm_response.txt /tmp/client_response.txt

echo "✅ Setup complete! You can now integrate SSO with your application."
