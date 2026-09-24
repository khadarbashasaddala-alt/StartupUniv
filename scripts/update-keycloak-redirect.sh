#!/bin/bash

# Update Keycloak client redirect URI to port 5432

KEYCLOAK_URL="http://localhost:8080"
ADMIN_USER="admin"
ADMIN_PASSWORD="admin"
REALM_NAME="startupvarsity"
CLIENT_ID="startupvarsity-app"

echo "🔧 Updating Keycloak redirect URI to port 5432..."

# Get admin token
TOKEN_RESPONSE=$(curl -s -X POST "$KEYCLOAK_URL/realms/master/protocol/openid-connect/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "username=$ADMIN_USER" \
  -d "password=$ADMIN_PASSWORD" \
  -d "grant_type=password" \
  -d "client_id=admin-cli")

ACCESS_TOKEN=$(echo $TOKEN_RESPONSE | grep -o '"access_token":"[^"]*' | cut -d'"' -f4)

if [ -z "$ACCESS_TOKEN" ]; then
  echo "❌ Failed to get admin token"
  exit 1
fi

# Get client UUID
CLIENT_UUID=$(curl -s -X GET "$KEYCLOAK_URL/admin/realms/$REALM_NAME/clients?clientId=$CLIENT_ID" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  | grep -o '"id":"[^"]*' | head -1 | cut -d'"' -f4)

if [ -z "$CLIENT_UUID" ]; then
  echo "❌ Failed to get client UUID"
  exit 1
fi

# Update client redirect URIs
UPDATE_RESPONSE=$(curl -s -w "%{http_code}" -o /tmp/update_client.txt -X PUT "$KEYCLOAK_URL/admin/realms/$REALM_NAME/clients/$CLIENT_UUID" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "clientId": "'$CLIENT_ID'",
    "redirectUris": [
      "http://localhost:5432/*",
      "http://localhost:5432/api/auth/callback"
    ],
    "webOrigins": [
      "http://localhost:5432"
    ]
  }')

if [ "$UPDATE_RESPONSE" == "204" ]; then
  echo "✅ Redirect URI updated successfully!"
  echo ""
  echo "New redirect URIs:"
  echo "  - http://localhost:5432/*"
  echo "  - http://localhost:5432/api/auth/callback"
else
  echo "⚠️  Update returned status: $UPDATE_RESPONSE"
  cat /tmp/update_client.txt
fi

rm -f /tmp/update_client.txt
