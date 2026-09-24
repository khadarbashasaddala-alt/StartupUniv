/**
 * Keycloak SSO Configuration
 * 
 * Provides configuration for OpenID Connect integration with Keycloak.
 * All values are loaded from environment variables with sensible defaults.
 */

export const keycloakConfig = {
  // Core Keycloak settings
  issuer: process.env.KEYCLOAK_ISSUER || 'http://localhost:8080/realms/startupvarsity',
  clientId: process.env.KEYCLOAK_CLIENT_ID || 'startupvarsity-app',
  clientSecret: process.env.KEYCLOAK_CLIENT_SECRET || '',
  redirectUri: process.env.KEYCLOAK_REDIRECT_URI || 'http://localhost:5000/api/auth/callback',
  
  // OpenID Connect scopes
  scopes: ['openid', 'profile', 'email'],
  
  // Feature flags
  enabled: process.env.ENABLE_SSO === 'true',
  allowLegacyLogin: process.env.ALLOW_LEGACY_LOGIN !== 'false', // Default to true
  autoMigrateUsers: process.env.AUTO_MIGRATE_USERS === 'true',
  
  // Admin API credentials (for user migration)
  adminUsername: process.env.KEYCLOAK_ADMIN_USERNAME || 'admin',
  adminPassword: process.env.KEYCLOAK_ADMIN_PASSWORD || 'admin',
  adminClientId: process.env.KEYCLOAK_ADMIN_CLIENT_ID || 'admin-cli',
  
  // Computed URLs
  get authorizationURL() {
    return `${this.issuer}/protocol/openid-connect/auth`;
  },
  get tokenURL() {
    return `${this.issuer}/protocol/openid-connect/token`;
  },
  get userInfoURL() {
    return `${this.issuer}/protocol/openid-connect/userinfo`;
  },
  get logoutURL() {
    return `${this.issuer}/protocol/openid-connect/logout`;
  },
  get adminTokenURL() {
    return this.issuer.replace(/\/realms\/.*$/, '/realms/master/protocol/openid-connect/token');
  },
  get adminUsersURL() {
    const realmName = this.issuer.split('/realms/')[1];
    return this.issuer.replace(/\/realms\/.*$/, `/admin/realms/${realmName}/users`);
  }
};

/**
 * Validate Keycloak configuration
 * @returns true if configuration is valid, false otherwise
 */
export function validateKeycloakConfig(): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (!keycloakConfig.enabled) {
    return { valid: true, errors: ['SSO is disabled'] };
  }
  
  if (!keycloakConfig.issuer) {
    errors.push('KEYCLOAK_ISSUER is required');
  }
  
  if (!keycloakConfig.clientId) {
    errors.push('KEYCLOAK_CLIENT_ID is required');
  }
  
  if (!keycloakConfig.clientSecret) {
    errors.push('KEYCLOAK_CLIENT_SECRET is required');
  }
  
  if (!keycloakConfig.redirectUri) {
    errors.push('KEYCLOAK_REDIRECT_URI is required');
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}
