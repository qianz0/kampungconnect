const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const AzureAdOAuth2Strategy = require('passport-azure-ad').OIDCStrategy;

/**
 * OIDC Provider Configurations
 */
class OIDCProviders {
    constructor() {
        this.initializeStrategies();
    }

    initializeStrategies() {
        let providersInitialized = 0;

        // Initialize all available providers based on environment variables
        if (this.isGoogleConfigured()) {
            this.setupGoogleStrategy();
            providersInitialized++;
            console.log('✅ Google OAuth strategy initialized');
        }

        if (this.isAzureConfigured()) {
            try {
                this.setupAzureStrategy();
                providersInitialized++;
                console.log('✅ Azure AD strategy initialized');
            } catch (error) {
                console.error('❌ Failed to initialize Azure AD strategy:', error.message);
                console.warn('⚠️  Continuing without Azure AD authentication...');
            }
        }

        if (providersInitialized === 0) {
            console.warn('⚠️  No OIDC providers configured. Please set provider credentials in environment variables.');
        } else {
            console.log(`🎉 ${providersInitialized} OIDC provider(s) initialized successfully`);
        }

        // Serialize/Deserialize user for session
        passport.serializeUser((user, done) => {
            done(null, user);
        });

        passport.deserializeUser((user, done) => {
            done(null, user);
        });
    }

    // Helper methods to check if provider credentials are configured
    isGoogleConfigured() {
        return !!(process.env.GOOGLE_CLIENT_ID && 
                 process.env.GOOGLE_CLIENT_SECRET && 
                 process.env.GOOGLE_REDIRECT_URI);
    }

    isAzureConfigured() {
        return !!(process.env.AZURE_CLIENT_ID && 
                 process.env.AZURE_CLIENT_SECRET && 
                 process.env.AZURE_TENANT_ID &&
                 process.env.AZURE_REDIRECT_URI);
    }

    setupGoogleStrategy() {
        passport.use('google', new GoogleStrategy({
            clientID: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
            callbackURL: process.env.GOOGLE_REDIRECT_URI
        }, async (accessToken, refreshToken, profile, done) => {
            try {
                // Helper function to parse full name into first and last name
                const parseFullName = (fullName) => {
                    if (!fullName) return { firstname: '', lastname: '' };
                    
                    const nameParts = fullName.trim().split(' ');
                    if (nameParts.length === 1) {
                        return { firstname: nameParts[0], lastname: '' };
                    } else if (nameParts.length === 2) {
                        return { firstname: nameParts[0], lastname: nameParts[1] };
                    } else {
                        // For names with more than 2 parts, take first as firstname and rest as lastname
                        return { 
                            firstname: nameParts[0], 
                            lastname: nameParts.slice(1).join(' ') 
                        };
                    }
                };

                const fullName = profile.displayName || '';
                const { firstname, lastname } = parseFullName(fullName);

                const user = {
                    id: profile.id,
                    email: profile.emails[0].value,
                    name: fullName,
                    firstname: firstname,
                    lastname: lastname,
                    picture: profile.photos[0].value,
                    provider: 'google'
                };
                return done(null, user);
            } catch (error) {
                return done(error, null);
            }
        }));
    }

    setupAzureStrategy() {
        try {
            // Log configuration for debugging (without exposing sensitive data)
            console.log('Setting up Azure strategy with configuration:');
            console.log('- Client ID:', process.env.AZURE_CLIENT_ID ? 'configured' : 'MISSING');
            console.log('- Client Secret:', process.env.AZURE_CLIENT_SECRET ? `configured (length: ${process.env.AZURE_CLIENT_SECRET.length})` : 'MISSING');
            console.log('- Tenant ID:', process.env.AZURE_TENANT_ID ? 'configured' : 'MISSING');
            console.log('- Redirect URI:', process.env.AZURE_REDIRECT_URI);
            
            // Use 'common' endpoint for multi-tenant support or specific tenant ID for single tenant
            const tenantId = process.env.AZURE_TENANT_ID === 'common' || process.env.AZURE_MULTITENANT === 'true' 
                ? 'common' 
                : process.env.AZURE_TENANT_ID;
                
            passport.use('azure', new AzureAdOAuth2Strategy({
                identityMetadata: `https://login.microsoftonline.com/${tenantId}/v2.0/.well-known/openid-configuration`,
                clientID: process.env.AZURE_CLIENT_ID,
                clientSecret: process.env.AZURE_CLIENT_SECRET,
                redirectUrl: process.env.AZURE_REDIRECT_URI,
                allowHttpForRedirectUrl: true, // For development only
                responseType: 'code',
                responseMode: 'query',
                scope: ['profile', 'email', 'openid'],
                loggingLevel: 'info', // Increase logging to help debug
                validateIssuer: false, // Allow different issuers for multi-tenant
                passReqToCallback: false,
                clockSkew: 300, // 5 minute clock skew tolerance
                // Additional Azure-specific configuration
                useCookieInsteadOfSession: false,
                cookieEncryptionKeys: null,
                nonceLifetime: null,
                nonceMaxAmount: 5,
                isB2C: false
            }, async (iss, sub, profile, accessToken, refreshToken, done) => {
                try {
                    console.log('✅ Azure AD authentication successful!');

                    // Helper function to parse full name into first and last name
                    const parseFullName = (fullName) => {
                        if (!fullName) return { firstname: '', lastname: '' };
                        
                        const nameParts = fullName.trim().split(' ');
                        if (nameParts.length === 1) {
                            return { firstname: nameParts[0], lastname: '' };
                        } else if (nameParts.length === 2) {
                            return { firstname: nameParts[0], lastname: nameParts[1] };
                        } else {
                            // For names with more than 2 parts, take first as firstname and rest as lastname
                            return { 
                                firstname: nameParts[0], 
                                lastname: nameParts.slice(1).join(' ') 
                            };
                        }
                    };

                    // Extract name from profile (try different possible fields)
                    // Azure AD can return names in various fields
                    const fullName = profile.displayName || 
                                   profile.name || 
                                   profile._json?.name || 
                                   profile._json?.displayName ||
                                   (profile._json?.given_name && profile._json?.family_name ? 
                                    `${profile._json.given_name} ${profile._json.family_name}` : '') ||
                                   '';
                    
                    const { firstname, lastname } = parseFullName(fullName);
                    
                    // Try to get more specific first/last names from Azure profile
                    const finalFirstName = firstname || 
                                         profile._json?.given_name || 
                                         profile._json?.givenName ||
                                         profile.givenName || '';
                    
                    const finallastname = lastname || 
                                        profile._json?.family_name || 
                                        profile._json?.familyName ||
                                        profile.familyName || '';
                    
                    const user = {
                        id: profile.oid || profile._json?.oid || profile.id,
                        email: profile._json?.email || 
                               profile._json?.preferred_username || 
                               profile._json?.mail ||
                               profile._json?.upn ||
                               profile.emails?.[0]?.value,
                        name: fullName,
                        firstname: finalFirstName,
                        lastname: finallastname,
                        provider: 'azure',
                        tenantId: profile.tid || profile._json?.tid,
                        picture: profile._json?.picture || profile.picture
                    };
                    
                    return done(null, user);
                } catch (error) {
                    console.error('❌ Azure profile processing error:', error);
                    return done(error, null);
                }
            }));
        } catch (error) {
            console.error('❌ Azure strategy setup failed:', error.message);
            throw error;
        }
    }

    getAuthRoutes() {
        const availableRoutes = {};

        if (this.isGoogleConfigured()) {
            availableRoutes.google = {
                auth: '/auth/google',
                callback: '/auth/google/callback',
                scope: ['profile', 'email']
            };
        }

        if (this.isAzureConfigured()) {
            availableRoutes.azure = {
                auth: '/auth/azure',
                callback: '/auth/azure/callback',
                scope: ['profile', 'email', 'openid']
            };
        }

        return availableRoutes;
    }

    getAvailableProviders() {
        const providers = [];
        
        if (this.isGoogleConfigured()) providers.push('google');
        if (this.isAzureConfigured()) providers.push('azure');
        
        return providers;
    }
}

module.exports = OIDCProviders;