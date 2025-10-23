# OIDC/SSO Implementation Guide for KampungConnect

## Overview

This document describes the OpenID Connect (OIDC) and Single Sign-On (SSO) implementation for KampungConnect. The system provides secure, centralized authentication using industry-standard protocols with comprehensive error handling and debugging capabilities.

## Architecture

### Components

1. **Auth Service** (Port 5001) - Central authentication service handling OIDC flows
2. **Shared Auth Middleware** - Reusable JWT validation for all microservices
3. **Frontend Auth Manager** - Client-side authentication with robust error handling
4. **OIDC Providers** - External identity providers (Google, Azure AD, Auth0)
5. **Database Service** - User data persistence and management
6. **JWT Utils** - Token generation and validation utilities

### Authentication Flow

```
1. User visits login page (/login.html)
2. Frontend AuthManager initializes and loads available OIDC providers
3. User clicks provider button (e.g., "Continue with Google")
4. Redirect to provider authorization server
5. User authenticates with provider
6. Provider redirects back with authorization code to /auth/{provider}/callback
7. Auth service exchanges code for tokens using Passport.js strategies
8. User data is stored/updated in PostgreSQL database
9. JWT token is generated with user claims and set as HTTP cookie
10. User is redirected to dashboard (/dashboard.html?authenticated=true)
11. Dashboard validates authentication and displays user info
```

### Enhanced Security Features

- **Token Validation**: Client-side JWT format validation before server requests
- **Timeout Handling**: Network request timeouts to prevent hanging
- **Retry Logic**: Robust AuthManager initialization with retry mechanisms  
- **Redirect Protection**: Prevention of infinite redirect loops
- **Error Logging**: Comprehensive console logging for debugging
- **Fallback Authentication**: Auth service validation if local JWT verification fails

## Setup Instructions

### 1. Configure OIDC Provider

Choose one of the supported providers and obtain credentials:

#### Google OAuth2
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create/select a project
3. Enable Google+ API or Google People API
4. Go to "Credentials" > "Create Credentials" > "OAuth 2.0 Client ID"
5. Configure OAuth consent screen (required)
6. Set application type to "Web application"
7. Add authorized redirect URIs:
   - `http://localhost:5001/auth/google/callback` (development)
   - `https://yourdomain.com/auth/google/callback` (production)
8. Note the Client ID and Client Secret

#### Microsoft Azure AD
1. Go to [Azure Portal](https://portal.azure.com/)
2. Navigate to Azure Active Directory > App registrations
3. Click "New registration"
4. Set name and supported account types
5. Add redirect URI: `http://localhost:5001/auth/azure/callback`
6. Go to "Certificates & secrets" > "New client secret"
7. Note Application ID, Tenant ID, and Client Secret

#### Auth0
1. Go to [Auth0 Dashboard](https://auth0.com/)
2. Create new application (Regular Web Application)
3. Configure settings:
   - Allowed Callback URLs: `http://localhost:5001/auth/auth0/callback`
   - Allowed Web Origins: `http://localhost:8080`
   - Allowed Logout URLs: `http://localhost:8080/login.html`
4. Note Domain, Client ID, and Client Secret

### 2. Environment Configuration

Create a `.env` file in the project root with your provider credentials:

```env
# Choose your OIDC provider (google, azure, or auth0)
OIDC_PROVIDER=google

# Google Configuration (if using Google)
GOOGLE_CLIENT_ID=your-client-id.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
GOOGLE_REDIRECT_URI=http://localhost:5001/auth/google/callback

# Azure AD Configuration (if using Azure)
AZURE_CLIENT_ID=your-azure-client-id
AZURE_CLIENT_SECRET=your-azure-client-secret
AZURE_TENANT_ID=your-tenant-id
AZURE_REDIRECT_URI=http://localhost:5001/auth/azure/callback

# Auth0 Configuration (if using Auth0)
AUTH0_DOMAIN=your-domain.auth0.com
AUTH0_CLIENT_ID=your-auth0-client-id
AUTH0_CLIENT_SECRET=your-auth0-client-secret
AUTH0_REDIRECT_URI=http://localhost:5001/auth/auth0/callback

# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
JWT_EXPIRATION=24h

# Application URLs
FRONTEND_URL=http://localhost:8080

# Database Configuration (handled by Docker Compose)
DB_HOST=db
DB_PORT=5432
DB_NAME=kampungconnect
DB_USER=admin
DB_PASSWORD=password
```

⚠️ **Important**: Never commit your `.env` file to version control. Add it to `.gitignore`.

### 3. Install Dependencies

The required dependencies are already configured in `package.json` files. Run:

```bash
cd backend/services/auth-service
npm install

cd ../request-service
npm install

# Repeat for other services as needed
```

### 4. Start the Application

```bash
# From project root
docker-compose up --build
```

## API Endpoints

### Auth Service (`http://localhost:5001`)

- `GET /` - Health check and service info
- `GET /auth-config` - Get available authentication methods
- `GET /auth/{provider}` - Initiate OIDC authentication
- `GET /auth/{provider}/callback` - OIDC callback handler
- `GET /me` - Get current authenticated user
- `POST /logout` - Logout user
- `POST /validate-token` - Validate JWT token (for other services)

### Request Service (`http://localhost:5002`)

- `GET /` - Health check (shows auth required)
- `GET /info` - Service information (public)
- `POST /postRequest` - Create community request (protected)
- `POST /panicRequest` - Create urgent request (protected)
- `GET /requests` - Get user's requests (protected)
- `GET /requests/:id` - Get request details (protected)

## Frontend Integration

### Enhanced AuthManager Class

The `AuthManager` class (`/js/auth.js`) provides comprehensive authentication handling:

**Core Methods:**
- `initialize()` - Load auth configuration and setup OIDC buttons
- `checkAuthentication()` - Verify user authentication with enhanced validation
- `getCurrentUser()` - Get current user information
- `logout()` - Securely logout user and clear tokens
- `authenticatedFetch()` - Make authenticated API requests with automatic token handling
- `removeToken()` - Clear authentication tokens from cookies and localStorage
- `isTokenFormatValid()` - Client-side JWT format validation

**Enhanced Features:**
- **Robust Initialization**: Retry mechanism with timeout handling
- **Token Validation**: Local JWT format checking before server requests  
- **Error Handling**: Comprehensive error logging and user feedback
- **Redirect Protection**: Prevents infinite redirect loops
- **Multiple Token Storage**: Supports both cookies and localStorage
- **Network Timeout**: 5-second timeout for authentication requests

### Usage Examples

#### Basic Authentication Check
```javascript
// Wait for AuthManager to be available (dashboard pattern)
async function waitForAuthManager() {
    return new Promise((resolve, reject) => {
        let attempts = 0;
        const maxAttempts = 50;
        
        function checkAuthManager() {
            attempts++;
            if (window.AuthManager && 
                typeof window.AuthManager.initialize === 'function') {
                resolve(window.AuthManager);
            } else if (attempts >= maxAttempts) {
                reject(new Error('AuthManager not available'));
            } else {
                setTimeout(checkAuthManager, 100);
            }
        }
        checkAuthManager();
    });
}

// Initialize and check authentication
const authManager = await waitForAuthManager();
await authManager.initialize();

const isAuthenticated = await authManager.checkAuthentication();
if (!isAuthenticated) {
    window.location.href = '/login.html';
}
```

#### Making Authenticated API Requests
```javascript
// The authenticatedFetch method automatically handles tokens
const response = await AuthManager.authenticatedFetch('http://localhost:5002/requests', {
    method: 'POST',
    body: JSON.stringify({
        category: 'groceries',
        type: 'normal',
        description: 'Need help with weekly shopping'
    })
});

if (response.ok) {
    const data = await response.json();
    console.log('Request created:', data);
}
```

#### Login Page Integration
```javascript
// Login page automatically detects and redirects if already authenticated
document.addEventListener('DOMContentLoaded', async () => {
    const authManager = await waitForAuthManager();
    await authManager.initialize();
    
    // Check if already authenticated
    const isAuthenticated = await authManager.checkAuthentication();
    if (isAuthenticated) {
        window.location.href = '/dashboard.html';
    }
});
```

## Security Features

### JWT Token Security
- **Signed Tokens**: JWT tokens signed with configurable secret (HS256)
- **Configurable Expiration**: Default 24h, customizable via JWT_EXPIRATION
- **Dual Storage**: Tokens stored in both HTTP cookies and localStorage for flexibility
- **Format Validation**: Client-side JWT format checking before server requests
- **Automatic Cleanup**: Invalid tokens automatically removed from storage
- **Timeout Protection**: 5-second network timeout for token validation requests

### OIDC Security
- **Standard OAuth2/OIDC Flow**: Authorization code grant with PKCE support
- **Server-Side Token Handling**: Sensitive operations performed server-side only
- **Secure User Storage**: User data validated and stored in PostgreSQL with proper constraints
- **Multiple Provider Support**: Google, Azure AD, Auth0 with provider-specific configurations
- **Redirect URI Validation**: Strict callback URL validation for security

### Enhanced Service-to-Service Security
- **Shared Auth Middleware**: Consistent JWT validation across all 6 microservices
- **Fallback Validation**: If local JWT verification fails, validates with auth service
- **Role-Based Access**: Support for user roles (senior, helper) with permission checking
- **Optional Authentication**: Endpoints can support both authenticated and anonymous access
- **Comprehensive Error Handling**: Detailed error responses for different failure scenarios
- **Service Health Monitoring**: Auth service health checks and circuit breaker patterns

## Adding OIDC to New Services

### 1. Update package.json

```json
{
  "name": "your-new-service",
  "version": "1.0.0",
  "main": "src/index.js",
  "dependencies": {
    "express": "^4.18.2",
    "cors": "^2.8.5",
    "jsonwebtoken": "^9.0.2",
    "axios": "^1.5.0",
    "cookie-parser": "^1.4.6",
    "dotenv": "^16.3.1"
  }
}
```

### 2. Import and Use Enhanced Middleware

```javascript
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const AuthMiddleware = require('/app/shared/auth-middleware');

const app = express();
const authMiddleware = new AuthMiddleware(process.env.AUTH_SERVICE_URL);

// Middleware setup
app.use(cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:8080',
    credentials: true
}));
app.use(express.json());
app.use(cookieParser());

// Public health check
app.get('/', (req, res) => {
    res.json({ 
        service: "your-new-service", 
        status: "running",
        authentication: "required for most endpoints"
    });
});

// Protected routes (requires authentication)
app.get('/protected-endpoint', authMiddleware.authenticateToken, (req, res) => {
    // req.user contains: { id, email, name, provider, role }
    res.json({ 
        message: 'Access granted',
        user: req.user 
    });
});

// Role-based protection (seniors only)
app.post('/senior-only', 
    authMiddleware.authenticateToken, 
    authMiddleware.requireRole('senior'), 
    (req, res) => {
        res.json({ message: 'Senior-only endpoint accessed' });
    }
);

// Optional authentication (works for both authenticated and anonymous)
app.get('/public-info', authMiddleware.optionalAuth, (req, res) => {
    if (req.user) {
        res.json({ 
            message: 'Hello authenticated user!', 
            user: req.user.name 
        });
    } else {
        res.json({ 
            message: 'Hello anonymous user!' 
        });
    }
});

// Error handling middleware
app.use((error, req, res, next) => {
    console.error('Service error:', error);
    res.status(500).json({ error: 'Internal server error' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Service running on port ${PORT}`);
});
```

### 3. Update docker-compose.yml

```yaml
your-new-service:
  build: ./backend/services/your-new-service
  ports:
    - "5007:5000"  # Use next available port
  environment:
    - JWT_SECRET=${JWT_SECRET}
    - AUTH_SERVICE_URL=http://auth-service:5000
    - FRONTEND_URL=${FRONTEND_URL}
    - DB_HOST=db
    - DB_PORT=5432
    - DB_NAME=kampungconnect
    - DB_USER=admin
    - DB_PASSWORD=password
  depends_on:
    - db
    - auth-service
  volumes:
    - ./backend/shared:/app/shared
```

### 4. Create Dockerfile

```dockerfile
FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./
RUN npm install

# Copy source code
COPY . .

# Expose port
EXPOSE 5000

# Start the service
CMD ["npm", "start"]
```

## Troubleshooting

### Common Issues & Solutions

#### 1. **"OIDC provider not configured"**
**Symptoms**: Login page shows development notice instead of login buttons
**Solutions**:
- Check `.env` file has correct `OIDC_PROVIDER` value (google/azure/auth0)
- Verify all provider credentials are set correctly
- Ensure Docker Compose can read the `.env` file
- Check auth service logs: `docker-compose logs auth-service`

#### 2. **"Authentication failed" or "AuthManager.initialize is not a function"**
**Symptoms**: JavaScript errors in browser console, infinite redirect loops
**Solutions**:
- Verify redirect URIs match exactly in provider settings
- Check client ID and secret are correct (no extra spaces)
- Ensure provider application is enabled and approved
- Clear browser cookies and localStorage: `AuthManager.removeToken()`

#### 3. **"Token validation failed" or 401 errors**
**Symptoms**: Dashboard loads but API requests fail
**Solutions**:
- Verify `JWT_SECRET` is consistent across all services
- Check token expiration settings (`JWT_EXPIRATION`)
- Ensure auth service is running: `docker-compose ps`
- Test token manually: `curl -H "Authorization: Bearer TOKEN" http://localhost:5001/me`

#### 4. **CORS errors**
**Symptoms**: "Access to fetch blocked by CORS policy" in browser
**Solutions**:
- Verify `FRONTEND_URL=http://localhost:8080` is set correctly
- Check CORS settings in all services match the frontend URL
- Ensure `credentials: true` is set for requests requiring cookies

#### 5. **Infinite redirect loop between login and dashboard**
**Symptoms**: Pages keep redirecting back and forth
**Solutions**:
- Check browser console for AuthManager initialization errors
- Verify dashboard authentication check is working properly
- Restart frontend container: `docker-compose restart frontend`

#### 6. **"Unable to load dashboard" message**
**Symptoms**: Dashboard shows loading overlay indefinitely
**Solutions**:
- Check if user authentication is properly set after OIDC callback
- Verify user data is correctly stored in database
- Check auth service `/me` endpoint response
- Look for JavaScript errors in browser console

### Debug Tools

#### 1. **Browser Developer Tools**
- **Console**: Check for JavaScript errors and AuthManager logs
- **Network**: Monitor API requests and responses
- **Application/Storage**: Inspect cookies and localStorage
- **Security**: Check for mixed content warnings

#### 2. **Docker Logs**
```bash
# View all service logs
docker-compose logs -f

# View specific service logs  
docker-compose logs -f auth-service
docker-compose logs -f frontend

# Check service health
docker-compose ps
```

#### 3. **Manual API Testing**
```bash
# Test auth service health
curl http://localhost:5001/

# Test auth configuration
curl http://localhost:5001/auth-config

# Test protected endpoint (replace TOKEN with actual JWT)
curl -H "Authorization: Bearer TOKEN" http://localhost:5001/me

# Test with cookies (if using cookie authentication)
curl -b "auth_token=TOKEN" http://localhost:5001/me
```

### Testing Authentication Flow

#### Complete Authentication Test:
1. **Clear existing state**: Visit debug page and clear all tokens
2. **Visit login**: `http://localhost:8080/login.html`
3. **Check provider button**: Should show "Continue with [Provider]" button
4. **Click authentication**: Should redirect to provider (Google/Azure/Auth0)
5. **Complete provider auth**: Login with your provider account
6. **Verify callback**: Should redirect back to `localhost:5001/auth/{provider}/callback`
7. **Check redirect**: Should end up at `localhost:8080/dashboard.html?authenticated=true`
8. **Verify dashboard**: Should display user info and no loading overlay
9. **Test API**: Make a request to a protected endpoint
10. **Test logout**: Click logout and verify redirect to login page

## Production Deployment

### Security Hardening

#### 1. **HTTPS Configuration**
```env
# Production environment variables
FRONTEND_URL=https://yourdomain.com
GOOGLE_REDIRECT_URI=https://yourdomain.com/auth/google/callback
AZURE_REDIRECT_URI=https://yourdomain.com/auth/azure/callback
AUTH0_REDIRECT_URI=https://yourdomain.com/auth/auth0/callback
```

#### 2. **Secure Cookie Configuration**
Update auth service cookie settings:
```javascript
// In auth-service callback handler
res.cookie('auth_token', token, {
    httpOnly: true,           // Prevent XSS attacks
    secure: true,             // HTTPS only
    sameSite: 'lax',         // CSRF protection
    maxAge: 24 * 60 * 60 * 1000,  // 24 hours
    domain: 'yourdomain.com'  // Explicit domain
});
```

#### 3. **Strong JWT Configuration**
```env
# Use a strong, unique secret (32+ characters)
JWT_SECRET=your-256-bit-secret-key-for-production-change-this-immediately
JWT_EXPIRATION=8h  # Shorter expiration for production
```

#### 4. **Additional Security Measures**
- Enable rate limiting on auth endpoints
- Implement CSRF protection middleware  
- Add security headers (helmet.js)
- Regular dependency security audits
- Monitor authentication logs for suspicious activity
- Implement account lockout after failed attempts

### Scalability & Performance

#### 1. **Database Optimization**
```sql
-- Add indexes for better performance
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_provider_id ON users(provider_id);
CREATE INDEX idx_requests_user_id ON requests(user_id);
CREATE INDEX idx_requests_status ON requests(status);
```

#### 2. **Caching Strategy**
```javascript
// Redis session storage for auth service
const session = require('express-session');
const RedisStore = require('connect-redis')(session);

app.use(session({
    store: new RedisStore({ host: 'redis', port: 6379 }),
    secret: process.env.JWT_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: { secure: true, maxAge: 24 * 60 * 60 * 1000 }
}));
```

#### 3. **Load Balancer Configuration**
```yaml
# docker-compose.prod.yml
version: '3.8'
services:
  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
      - ./ssl:/etc/ssl
    depends_on:
      - frontend
      
  auth-service:
    deploy:
      replicas: 2  # Multiple instances
    environment:
      - NODE_ENV=production
      
  request-service:
    deploy:
      replicas: 3  # Scale based on load
```

### Monitoring & Observability

#### 1. **Authentication Logging**
```javascript
// Enhanced logging in auth service
const winston = require('winston');

const logger = winston.createLogger({
    level: 'info',
    format: winston.format.json(),
    transports: [
        new winston.transports.File({ filename: 'auth-error.log', level: 'error' }),
        new winston.transports.File({ filename: 'auth-combined.log' })
    ]
});

// Log authentication attempts
app.get('/auth/:provider/callback', (req, res, next) => {
    logger.info({
        event: 'auth_attempt',
        provider: req.params.provider,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        timestamp: new Date().toISOString()
    });
    next();
});
```

#### 2. **Health Checks & Metrics**
```javascript
// Add health check endpoints
app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        environment: process.env.NODE_ENV
    });
});

app.get('/metrics', (req, res) => {
    // Implement metrics collection (Prometheus format)
    res.json({
        auth_attempts_total: authAttemptCounter,
        active_sessions: activeSessionCount,
        token_validation_errors: tokenErrorCounter
    });
});
```

#### 3. **Alerting Setup**
- Monitor failed authentication rates
- Track token expiration and renewal patterns  
- Set up alerts for service downtime
- Monitor database connection health
- Track API response times and error rates

### Backup & Recovery

#### 1. **Database Backups**
```bash
# Automated PostgreSQL backup
#!/bin/bash
docker exec kampungconnect-db-1 pg_dump -U admin kampungconnect > backup_$(date +%Y%m%d_%H%M%S).sql

# Restore from backup
docker exec -i kampungconnect-db-1 psql -U admin kampungconnect < backup_file.sql
```

#### 2. **Configuration Backup**
- Store `.env` files securely (encrypted)
- Version control docker-compose files
- Document OIDC provider configurations
- Backup SSL certificates and keys

## Code Examples & Snippets

### Creating a New Protected Endpoint

```javascript
// In your service (e.g., request-service)
app.post('/create-request', authMiddleware.authenticateToken, async (req, res) => {
    try {
        const { category, type, description } = req.body;
        const userId = req.user.id;  // From JWT token
        
        // Validate input
        if (!category || !type || !description) {
            return res.status(400).json({ 
                error: 'Missing required fields' 
            });
        }
        
        // Create request in database
        const newRequest = await createUserRequest({
            user_id: userId,
            category,
            type,
            description
        });
        
        res.status(201).json({
            success: true,
            request: newRequest
        });
        
    } catch (error) {
        console.error('Create request error:', error);
        res.status(500).json({ 
            error: 'Failed to create request' 
        });
    }
});
```

### Frontend Authentication Integration

```javascript
// Example: Creating a new request from frontend
async function createHelpRequest(requestData) {
    try {
        const response = await AuthManager.authenticatedFetch('http://localhost:5002/create-request', {
            method: 'POST',
            body: JSON.stringify(requestData)
        });
        
        if (response.ok) {
            const result = await response.json();
            showSuccessMessage('Request created successfully!');
            return result;
        } else {
            const error = await response.json();
            showErrorMessage(error.message || 'Failed to create request');
        }
    } catch (error) {
        console.error('Request creation error:', error);
        showErrorMessage('Network error. Please try again.');
    }
}

// Usage
createHelpRequest({
    category: 'groceries',
    type: 'normal',
    description: 'Need help with weekly shopping'
});
```

## Support & Troubleshooting

### For Issues with Authentication Implementation:

#### 1. **Immediate Steps**
- Check browser console for JavaScript errors
- Clear browser cookies and localStorage
- Restart Docker services: `docker-compose restart`

#### 2. **Check Service Logs**
```bash
# Auth service logs (most important for OIDC issues)
docker-compose logs -f auth-service

# Frontend logs (for static file issues)
docker-compose logs -f frontend

# Database logs (for connection issues)
docker-compose logs -f db
```

#### 3. **Verify Configuration**
- Check `.env` file exists and has correct values
- Verify OIDC provider settings (redirect URIs, client credentials)
- Test auth service health: `curl http://localhost:5001/`
- Validate JWT secret consistency across services

#### 4. **Network Connectivity**
```bash
# Test service connectivity
docker-compose exec auth-service curl http://db:5432
docker-compose exec frontend curl http://auth-service:5000
```

### Getting Help

1. **Documentation**: Review this guide and the main README.md
2. **Debug Tools**: Use the built-in authentication debug page
3. **Logs**: Always include relevant Docker logs when asking for help
4. **Provider Docs**: Check your OIDC provider's specific documentation
5. **GitHub Issues**: Create detailed issues with logs and configuration (sanitized)

## Additional Resources

### Official Documentation
- [OpenID Connect Specification](https://openid.net/connect/) - OIDC standard
- [OAuth 2.0 Security Best Practices](https://tools.ietf.org/html/draft-ietf-oauth-security-topics) - Security guidelines
- [JWT Best Practices](https://tools.ietf.org/html/rfc8725) - Token security
- [Passport.js Documentation](http://www.passportjs.org/docs/) - Authentication strategies

### Provider-Specific Guides
- [Google OAuth 2.0](https://developers.google.com/identity/protocols/oauth2) - Google implementation
- [Microsoft Identity Platform](https://docs.microsoft.com/en-us/azure/active-directory/develop/) - Azure AD integration
- [Auth0 Documentation](https://auth0.com/docs) - Auth0 setup and configuration

### Development Tools
- [JWT.io Debugger](https://jwt.io/) - Decode and verify JWT tokens
- [OAuth 2.0 Playground](https://developers.google.com/oauthplayground) - Test OAuth flows
- [Postman OAuth 2.0](https://learning.postman.com/docs/sending-requests/authorization/#oauth-20) - API testing with OAuth

### Docker & Containerization
- [Docker Compose Reference](https://docs.docker.com/compose/compose-file/) - Configuration options
- [Docker Networking](https://docs.docker.com/network/) - Service communication
- [Multi-stage Docker Builds](https://docs.docker.com/develop/dev-best-practices/) - Optimization techniques

---

**Last Updated**: October 2025  
**Version**: 2.0 - Enhanced with comprehensive error handling and debugging capabilities