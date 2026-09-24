#!/bin/bash

# Create a test user in Keycloak startupvarsity realm

KEYCLOAK_URL="http://localhost:8080"
ADMIN_USER="admin"
ADMIN_PASSWORD="admin"
REALM_NAME="startupvarsity"

echo "🔐 Creating test user in Keycloak..."

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

# Create test user
USER_CREATE=$(curl -s -w "%{http_code}" -o /tmp/user_create.txt -X POST "$KEYCLOAK_URL/admin/realms/$REALM_NAME/users" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testuser",
    "email": "test@example.com",
    "firstName": "Test",
    "lastName": "User",
    "enabled": true,
    "emailVerified": true,
    "credentials": [{
      "type": "password",
      "value": "test123",
      "temporary": false
    }]
  }')

if [ "$USER_CREATE" == "201" ] || [ "$USER_CREATE" == "409" ]; then
  echo "✅ Test user created successfully!"
  echo ""
  echo "Login credentials:"
  echo "  Username: testuser"
  echo "  Password: test123"
  echo ""
  echo "Now go back to your login page and use these credentials!"
else
  echo "⚠️  User creation returned status: $USER_CREATE"
  cat /tmp/user_create.txt
fi

rm -f /tmp/user_create.txt
