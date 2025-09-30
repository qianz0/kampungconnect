# KampungConnect 🏘️

A community-driven platform that connects seniors with local helpers for daily assistance, built with modern web technologies and secure authentication.

## 📋 Overview

KampungConnect is a microservices-based web application that facilitates community support by allowing seniors to request help and connecting them with willing community helpers. The platform emphasizes security, scalability, and user-friendly design.

### Key Features

- 🔐 **Secure Authentication** - OIDC/SSO integration with Google, Azure AD, and Auth0
- 🤝 **Community Matching** - Intelligent matching system between seniors and helpers
- 📱 **Responsive Design** - Mobile-friendly interface built with Bootstrap 5
- 🔔 **Real-time Notifications** - Keep users updated on request status
- ⭐ **Rating System** - Community trust through user ratings
- 🚨 **Priority Routing** - Urgent requests get priority handling
- 🐳 **Containerized** - Easy deployment with Docker Compose

## 🏗️ Architecture

### Microservices Structure

```
kampungconnect/
├── frontend/                 # Static web application
│   ├── css/
│   ├── js/
│   └── *.html
├── backend/
│   ├── services/
│   │   ├── auth-service/     # Authentication & user management
│   │   ├── request-service/  # Help request management
│   │   ├── matching-service/ # User matching logic
│   │   ├── notification-service/ # Notifications
│   │   ├── priority-router-service/ # Urgent request handling
│   │   └── rating-service/   # User rating system
│   ├── shared/              # Common middleware & utilities
│   └── db/                  # Database initialization
└── docker-compose.yml       # Container orchestration
```

### Technology Stack

**Frontend:**
- HTML5, CSS3, JavaScript (ES6+)
- Bootstrap 5.3.0 for responsive design
- Font Awesome 6.4.0 for icons
- Fetch API for HTTP requests

**Backend:**
- Node.js with Express.js framework
- PostgreSQL database
- JWT for authentication tokens
- Passport.js for OIDC integration

**Infrastructure:**
- Docker & Docker Compose
- Nginx (for frontend serving)
- CORS-enabled microservices

## 🚀 Quick Start

### Prerequisites

- Docker and Docker Compose installed
- An OIDC provider account (Google, Azure AD, or Auth0)
- Basic knowledge of environment variables

### 1. Clone the Repository

```bash
git clone https://github.com/qianz0/kampungconnect.git
cd kampungconnect
```

### 2. Configure Environment Variables

Create a `.env` file in the project root:

```env
# Choose your OIDC provider (google, azure, or auth0)
OIDC_PROVIDER=google

# Google OAuth Configuration (if using Google)
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
```

### 3. Set Up OIDC Provider

Choose one provider and follow the setup instructions:

#### Google OAuth2 Setup
1. Visit [Google Cloud Console](https://console.cloud.google.com/)
2. Create/select a project
3. Enable Google+ API
4. Create OAuth 2.0 credentials
5. Add authorized redirect URI: `http://localhost:5001/auth/google/callback`

#### Microsoft Azure AD Setup
1. Visit [Azure Portal](https://portal.azure.com/)
2. Navigate to Azure Active Directory > App registrations
3. Create new registration
4. Add redirect URI: `http://localhost:5001/auth/azure/callback`
5. Create client secret

#### Auth0 Setup
1. Visit [Auth0 Dashboard](https://auth0.com/)
2. Create new application (Single Page Application)
3. Add callback URL: `http://localhost:5001/auth/auth0/callback`
4. Note domain, client ID, and secret

### 4. Build and Run

```bash
# Build and start all services
docker-compose up --build

# Or run in background
docker-compose up --build -d
```

### 5. Access the Application

- **Frontend**: http://localhost:8080
- **Auth Service**: http://localhost:5001
- **Other Services**: Ports 5002-5006
- **Database**: PostgreSQL on localhost:5432

## 📝 API Documentation

### Authentication Service (Port 5001)

| Endpoint | Method | Description | Auth Required |
|----------|--------|-------------|---------------|
| `/` | GET | Health check | No |
| `/auth-config` | GET | Get available auth methods | No |
| `/auth/{provider}` | GET | Initiate OIDC login | No |
| `/auth/{provider}/callback` | GET | OIDC callback handler | No |
| `/me` | GET | Get current user info | Yes |
| `/logout` | POST | Logout user | Yes |
| `/validate-token` | POST | Validate JWT token | No |

### Request Service (Port 5002)

| Endpoint | Method | Description | Auth Required |
|----------|--------|-------------|---------------|
| `/` | GET | Service health check | No |
| `/postRequest` | POST | Create help request | Yes |
| `/panicRequest` | POST | Create urgent request | Yes |
| `/requests` | GET | Get user's requests | Yes |
| `/requests/:id` | GET | Get request details | Yes |

### Other Services (Ports 5003-5006)

- **Matching Service** (5003): User matching logic
- **Notification Service** (5004): Push notifications
- **Priority Router** (5005): Urgent request routing
- **Rating Service** (5006): User rating system

## 🔧 Development

### Local Development Setup

```bash
# Install dependencies for each service
cd backend/services/auth-service && npm install
cd ../request-service && npm install
# ... repeat for other services

# Run individual services in development mode
npm run dev  # (if nodemon is configured)
```

### Project Structure Details

```
frontend/
├── index.html              # Landing page
├── login.html             # Authentication page
├── dashboard.html         # User dashboard
├── requests.html          # Request management
├── auth-debug.html        # Authentication debugging
├── js/
│   ├── auth.js           # Authentication manager
│   └── main.js           # Common utilities
└── css/
    └── style.css         # Custom styles

backend/services/auth-service/
├── src/
│   ├── index.js          # Main service entry
│   ├── database-service.js # Database operations
│   ├── jwt-utils.js      # JWT token handling
│   └── oidc-providers.js # OIDC provider configurations
├── Dockerfile
└── package.json

backend/shared/
└── auth-middleware.js    # Shared authentication middleware
```

### Database Schema

The application uses PostgreSQL with the following main tables:

- **users**: User profiles with OIDC integration
- **requests**: Help requests (normal/urgent)
- **matches**: Connections between seniors and helpers
- **ratings**: Community rating system
- **notifications**: User notification history

## 🔒 Security Features

- **OIDC/OAuth2**: Industry-standard authentication
- **JWT Tokens**: Secure session management
- **CORS Protection**: Cross-origin request security
- **Input Validation**: SQL injection prevention
- **Rate Limiting**: API abuse protection
- **Secure Headers**: XSS and CSRF protection

## 🧪 Testing

### Manual Testing

1. **Authentication Flow**:
   - Visit `/login.html`
   - Test OIDC provider login
   - Verify dashboard access

2. **API Testing**:
   ```bash
   # Test auth service health
   curl http://localhost:5001/

   # Test authenticated endpoint
   curl -H "Authorization: Bearer YOUR_JWT_TOKEN" http://localhost:5001/me
   ```

3. **Debug Tools**:
   - Use `/auth-debug.html` for authentication troubleshooting
   - Check browser console for detailed logs
   - Monitor Docker logs: `docker-compose logs -f`

## 🚀 Deployment

### Production Considerations

1. **Environment Variables**:
   - Use strong, unique JWT secrets
   - Configure HTTPS URLs for OIDC redirects
   - Set secure cookie flags

2. **Docker Production**:
   ```bash
   # Production build
   docker-compose -f docker-compose.prod.yml up --build

   # Scale services
   docker-compose up --scale request-service=3
   ```

3. **Security Hardening**:
   - Enable HTTPS with SSL certificates
   - Use a reverse proxy (nginx/Apache)
   - Implement rate limiting
   - Regular security updates

## 🔧 Troubleshooting

### Common Issues

| Issue | Solution |
|-------|----------|
| "OIDC provider not configured" | Check `.env` file and provider credentials |
| "Authentication failed" | Verify redirect URIs in provider settings |
| "Token validation failed" | Ensure JWT_SECRET is consistent across services |
| "CORS errors" | Check FRONTEND_URL configuration |
| Infinite redirect loop | Clear browser cookies and tokens |

### Debug Tools

- **Authentication Debug Page**: `/auth-debug.html`
- **Browser Console**: Enable verbose logging
- **Docker Logs**: `docker-compose logs [service-name]`
- **Database Access**: Connect to PostgreSQL on port 5432

### Logs and Monitoring

```bash
# View all service logs
docker-compose logs -f

# View specific service logs
docker-compose logs -f auth-service

# Check service health
docker-compose ps
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature-name`
3. Make your changes
4. Test thoroughly
5. Commit: `git commit -m "Add feature"`
6. Push: `git push origin feature-name`
7. Create a Pull Request

### Development Guidelines

- Follow RESTful API conventions
- Add proper error handling
- Write meaningful commit messages
- Test authentication flows
- Update documentation

## 📚 Additional Resources

- [OIDC Implementation Guide](./OIDC_SSO_GUIDE.md) - Detailed authentication setup
- [OpenID Connect Specification](https://openid.net/connect/)
- [Docker Compose Documentation](https://docs.docker.com/compose/)
- [Express.js Guide](https://expressjs.com/)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 📞 Support

For issues and questions:
1. Check the troubleshooting section above
2. Review Docker and service logs
3. Test OIDC provider configuration
4. Create an issue on GitHub

---

**KampungConnect** - Building stronger communities through technology 🏘️❤️