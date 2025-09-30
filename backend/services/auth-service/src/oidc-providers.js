const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const AzureAdOAuth2Strategy = require('passport-azure-ad').OIDCStrategy;
const Auth0Strategy = require('passport-auth0');

/**
 * OIDC Provider Configurations
 */
class OIDCProviders {
    constructor() {
        this.initializeStrategies();
    }

    initializeStrategies() {
        const provider = process.env.OIDC_PROVIDER;

        switch (provider) {
            case 'google':
                this.setupGoogleStrategy();
                break;
            case 'azure':
                this.setupAzureStrategy();
                break;
            case 'auth0':
                this.setupAuth0Strategy();
                break;
            default:
                console.warn('No OIDC provider specified. Please set OIDC_PROVIDER in environment variables.');
        }

        // Serialize/Deserialize user for session
        passport.serializeUser((user, done) => {
            done(null, user);
        });

        passport.deserializeUser((user, done) => {
            done(null, user);
        });
    }

    setupGoogleStrategy() {
        passport.use(new GoogleStrategy({
            clientID: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
            callbackURL: process.env.GOOGLE_REDIRECT_URI
        }, async (accessToken, refreshToken, profile, done) => {
            try {
                const user = {
                    id: profile.id,
                    email: profile.emails[0].value,
                    name: profile.displayName,
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
        passport.use(new AzureAdOAuth2Strategy({
            identityMetadata: `https://login.microsoftonline.com/${process.env.AZURE_TENANT_ID}/v2.0/.well-known/openid_configuration`,
            clientID: process.env.AZURE_CLIENT_ID,
            clientSecret: process.env.AZURE_CLIENT_SECRET,
            redirectUrl: process.env.AZURE_REDIRECT_URI,
            allowHttpForRedirectUrl: true, // For development only
            responseType: 'code',
            responseMode: 'query',
            scope: ['profile', 'email', 'openid']
        }, async (iss, sub, profile, accessToken, refreshToken, done) => {
            try {
                const user = {
                    id: profile.oid,
                    email: profile.preferred_username || profile.email,
                    name: profile.name,
                    provider: 'azure'
                };
                return done(null, user);
            } catch (error) {
                return done(error, null);
            }
        }));
    }

    setupAuth0Strategy() {
        passport.use(new Auth0Strategy({
            domain: process.env.AUTH0_DOMAIN,
            clientID: process.env.AUTH0_CLIENT_ID,
            clientSecret: process.env.AUTH0_CLIENT_SECRET,
            callbackURL: process.env.AUTH0_REDIRECT_URI
        }, async (accessToken, refreshToken, extraParams, profile, done) => {
            try {
                const user = {
                    id: profile.id,
                    email: profile.emails[0].value,
                    name: profile.displayName,
                    picture: profile.picture,
                    provider: 'auth0'
                };
                return done(null, user);
            } catch (error) {
                return done(error, null);
            }
        }));
    }

    getAuthRoutes() {
        const provider = process.env.OIDC_PROVIDER;
        
        switch (provider) {
            case 'google':
                return {
                    auth: '/auth/google',
                    callback: '/auth/google/callback',
                    scope: ['profile', 'email']
                };
            case 'azure':
                return {
                    auth: '/auth/azure',
                    callback: '/auth/azure/callback',
                    scope: ['profile', 'email', 'openid']
                };
            case 'auth0':
                return {
                    auth: '/auth/auth0',
                    callback: '/auth/auth0/callback',
                    scope: ['openid', 'email', 'profile']
                };
            default:
                return null;
        }
    }
}

module.exports = OIDCProviders;