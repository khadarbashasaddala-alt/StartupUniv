/**
 * Keycloak SSO Authentication Service
 * 
 * Handles OpenID Connect authentication flow with Keycloak:
 * - User authorization and token exchange
 * - User info retrieval
 * - Token refresh
 * - User migration to Keycloak
 * - Single logout
 */

import { Issuer, Client, TokenSet, generators } from 'openid-client';
import { keycloakConfig, validateKeycloakConfig } from '../config/keycloak';
import { storage } from '../storage';
import type { User } from '@shared/schema';

let keycloakClient: Client | null = null;
let isInitialized = false;

/**
 * Initialize Keycloak OpenID Connect client
 * This should be called on server startup
 */
export async function initKeycloakClient(): Promise<boolean> {
  if (isInitialized) {
    return true;
  }

  // Check if SSO is enabled
  if (!keycloakConfig.enabled) {
    console.log('ℹ️  SSO is disabled (ENABLE_SSO=false)');
    return false;
  }

  // Validate configuration
  const validation = validateKeycloakConfig();
  if (!validation.valid) {
    console.warn('⚠️  Keycloak configuration is invalid:');
    validation.errors.forEach(error => console.warn(`   - ${error}`));
    return false;
  }

  try {
    console.log('🔧 Initializing Keycloak client...');
    console.log(`   Issuer: ${keycloakConfig.issuer}`);
    
    // Discover Keycloak's OpenID Connect endpoints
    const issuer = await Issuer.discover(keycloakConfig.issuer);
    
    // Create OpenID Connect client
    keycloakClient = new issuer.Client({
      client_id: keycloakConfig.clientId,
      client_secret: keycloakConfig.clientSecret,
      redirect_uris: [keycloakConfig.redirectUri],
      response_types: ['code'],
    });

    isInitialized = true;
    console.log('✅ Keycloak client initialized successfully');
    console.log(`   Redirect URI: ${keycloakConfig.redirectUri}`);
    return true;
  } catch (error) {
    console.error('❌ Failed to initialize Keycloak client:', error);
    console.error('   SSO features will be unavailable');
    console.error('   Regular login will continue to work normally');
    return false;
  }
}

/**
 * Check if SSO is available
 */
export function isSSOAvailable(): boolean {
  return isInitialized && keycloakClient !== null && keycloakConfig.enabled;
}

/**
 * Generate authorization URL for OAuth2 flow
 * Returns URL to redirect user to Keycloak login page and the code verifier
 */
export function getAuthorizationUrl(state: string, nonce: string): { url: string; codeVerifier: string } {
  if (!keycloakClient) {
    throw new Error('Keycloak client not initialized. Call initKeycloakClient() first.');
  }

  const codeVerifier = generators.codeVerifier();
  const codeChallenge = generators.codeChallenge(codeVerifier);

  const authUrl = keycloakClient.authorizationUrl({
    scope: keycloakConfig.scopes.join(' '),
    state,
    nonce,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
  });

  return { url: authUrl, codeVerifier };
}

/**
 * Handle OAuth2 callback and exchange code for tokens
 * Returns the authenticated user from database (creates if needed)
 */
export async function handleCallback(
  code: string,
  state: string,
  nonce: string,
  codeVerifier: string
): Promise<{ user: User; tokens: TokenSet } | null> {
  if (!keycloakClient) {
    throw new Error('Keycloak client not initialized');
  }

  try {
    // Exchange authorization code for tokens using grant method (more flexible)
    const tokenSet = await keycloakClient.grant({
      grant_type: 'authorization_code',
      code,
      redirect_uri: keycloakConfig.redirectUri,
      code_verifier: codeVerifier,
    });

    // Get user information from Keycloak
    const userInfo = await keycloakClient.userinfo(tokenSet.access_token!);
    
    console.log('🔐 SSO Login:', {
      email: userInfo.email,
      keycloakId: userInfo.sub,
      name: userInfo.name,
    });

    // Find existing user by Keycloak ID
    let user = await storage.getUserByKeycloakId(userInfo.sub as string);

    if (!user) {
      // Try to find by email (for migration scenario)
      user = await storage.getUserByEmail((userInfo.email as string).toLowerCase());

      if (user) {
        // Link existing user to Keycloak
        console.log(`🔗 Linking existing user ${user.email} to Keycloak ID: ${userInfo.sub}`);
        await storage.updateUser(user.id, {
          keycloakId: userInfo.sub as string,
        });
        user.keycloakId = userInfo.sub as string;
      } else if (keycloakConfig.autoMigrateUsers) {
        // Create new user from Keycloak info
        console.log(`➕ Creating new user from SSO: ${userInfo.email}`);
        user = await storage.createUser({
          email: (userInfo.email as string).toLowerCase(),
          name: (userInfo.name as string) || (userInfo.email as string),
          role: 'LEARNER', // Default role for new SSO users
          keycloakId: userInfo.sub as string,
          password: undefined, // SSO users don't have local password
        });
      } else {
        console.warn(`⚠️  User ${userInfo.email} not found and auto-migration is disabled`);
        return null;
      }
    }

    return { user, tokens: tokenSet };
  } catch (error) {
    console.error('❌ SSO callback error:', error);
    return null;
  }
}

/**
 * Refresh access token using refresh token
 */
export async function refreshToken(refreshToken: string): Promise<TokenSet | null> {
  if (!keycloakClient) {
    throw new Error('Keycloak client not initialized');
  }

  try {
    const tokenSet = await keycloakClient.refresh(refreshToken);
    return tokenSet;
  } catch (error) {
    console.error('❌ Token refresh error:', error);
    return null;
  }
}

/**
 * Get logout URL for single sign-out
 * Logs user out of Keycloak and all connected applications
 */
export function getLogoutUrl(idToken: string, postLogoutRedirectUri: string): string {
  if (!keycloakClient) {
    throw new Error('Keycloak client not initialized');
  }

  return keycloakClient.endSessionUrl({
    id_token_hint: idToken,
    post_logout_redirect_uri: postLogoutRedirectUri,
  });
}

/**
 * Migrate existing user to Keycloak (Admin API)
 * Creates user in Keycloak with same credentials
 */
export async function migrateUserToKeycloak(
  user: User,
  password: string
): Promise<string | null> {
  if (!keycloakConfig.enabled) {
    return null;
  }

  try {
    // Get admin access token
    const adminToken = await getKeycloakAdminToken();
    if (!adminToken) {
      console.error('Failed to get admin token for user migration');
      return null;
    }

    const [firstName, ...lastNameParts] = user.name.split(' ');
    const lastName = lastNameParts.join(' ');

    // Create user in Keycloak
    const response = await fetch(keycloakConfig.adminUsersURL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        username: user.email,
        email: user.email,
        firstName: firstName || user.email,
        lastName: lastName || '',
        enabled: true,
        emailVerified: true,
        credentials: password ? [{
          type: 'password',
          value: password,
          temporary: false,
        }] : [],
      }),
    });

    if (response.ok || response.status === 409) { // 409 = already exists
      // Get the created user's ID
      const usersResponse = await fetch(
        `${keycloakConfig.adminUsersURL}?email=${encodeURIComponent(user.email)}`,
        {
          headers: {
            'Authorization': `Bearer ${adminToken}`,
          },
        }
      );

      if (usersResponse.ok) {
        const users = await usersResponse.json();
        if (users.length > 0) {
          const keycloakId = users[0].id;
          console.log(`✅ Migrated user ${user.email} to Keycloak: ${keycloakId}`);
          
          // Update user in database with Keycloak ID
          await storage.updateUser(user.id, { keycloakId });
          
          return keycloakId;
        }
      }
    } else {
      const errorText = await response.text();
      console.error(`Failed to create user in Keycloak: ${errorText}`);
    }

    return null;
  } catch (error) {
    console.error('Error migrating user to Keycloak:', error);
    return null;
  }
}

/**
 * Get Keycloak admin access token
 * Used for Admin API operations (user migration, etc.)
 */
async function getKeycloakAdminToken(): Promise<string | null> {
  try {
    const response = await fetch(keycloakConfig.adminTokenURL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        username: keycloakConfig.adminUsername,
        password: keycloakConfig.adminPassword,
        grant_type: 'password',
        client_id: keycloakConfig.adminClientId,
      }),
    });

    if (response.ok) {
      const data = await response.json();
      return data.access_token;
    }

    return null;
  } catch (error) {
    console.error('Error getting admin token:', error);
    return null;
  }
}
