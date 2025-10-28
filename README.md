# KampungConnect 🏘️

A comprehensive community-driven platform that connects seniors with local helpers for daily assistance, built with modern web technologies, secure authentication, and advanced database management capabilities.

## 📋 Overview

KampungConnect is a microservices-based web application that facilitates community support by allowing seniors to request help and connecting them with willing community helpers. The platform emphasizes security, scalability, user-friendly design, and provides comprehensive database management tools for both local development and cloud deployment.

### Key Features

- 🔐 **Secure Authentication** - OIDC/SSO integration with Google and Azure AD
- 🤝 **Community Matching** - Intelligent matching system between seniors and helpers
- 📱 **Responsive Design** - Mobile-friendly interface built with Bootstrap 5
- 🔔 **Real-time Notifications** - Keep users updated on request status
- ⭐ **Rating System** - Community trust through user ratings
- 🚨 **Priority Routing** - Urgent requests get priority handling
- 🐳 **Containerized** - Easy deployment with Docker Compose
- ☁️ **AWS RDS Integration** - Seamless synchronization with AWS RDS PostgreSQL
- 🔍 **Database Management** - Secure web-based database viewers for local and cloud databases
- 🔄 **Data Synchronization** - Automated sync tools between local and AWS RDS instances

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
- Nginx for static file serving

**Backend:**

- Node.js with Express.js framework
- PostgreSQL database (local and AWS RDS)
- JWT for authentication tokens
- Passport.js for OIDC integration
- 6 specialized microservices

**Infrastructure:**

- Docker & Docker Compose
- AWS RDS PostgreSQL integration
- CORS-enabled microservices
- Secure database management tools

**Development & Database Tools:**

- Local PostgreSQL database viewer
- AWS RDS database viewer
- Automated database synchronization
- Connection testing utilities
- Data comparison tools

## 🚀 Quick Start

### Prerequisites

- Docker and Docker Compose installed
- An OIDC provider account (Google/Azure AD)
- Basic knowledge of environment variables

### 1. Clone the Repository

```bash
git clone https://github.com/qianz0/kampungconnect.git
cd kampungconnect
```

### 2. Configure Environment Variables

Create a `.env` file in the project root:

```env
# Choose your OIDC provider (google/azure)
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

# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
JWT_EXPIRATION=24h

# Application URLs
FRONTEND_URL=http://localhost:8080
```

### 3. Set Up OIDC Providers

Follow the set up instructions for each providers:

#### Google Setup

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

### 4. Build and Run

```bash
# Remove old build
docker-compose down

# Build and start all services
docker-compose --file docker-compose.yml up --build

# Or run in background
docker-compose --file docker-compose.yml up --build -d
```

### 5. Access the Application

- **Frontend**: http://localhost:8080
- **Auth Service**: http://localhost:5001
- **Other Services**: Ports 5002-5006 (Request, Matching, Notification, Priority Router, Rating)
- **Database**: PostgreSQL on localhost:5432
- **Database Viewer (Local)**: http://localhost:3001 (via `npm run db-viewer`)
- **Database Viewer (AWS RDS)**: http://localhost:3002 (via `npm run db-viewer-aws`)

## 📝 API Documentation

### Authentication Service (Port 5001)

| Endpoint                      | Method | Description                | Auth Required |
| ----------------------------- | ------ | -------------------------- | ------------- |
| `/`                         | GET    | Health check               | No            |
| `/auth-config`              | GET    | Get available auth methods | No            |
| `/auth/{provider}`          | GET    | Initiate OIDC login        | No            |
| `/auth/{provider}/callback` | GET    | OIDC callback handler      | No            |
| `/me`                       | GET    | Get current user info      | Yes           |
| `/logout`                   | POST   | Logout user                | Yes           |
| `/validate-token`           | POST   | Validate JWT token         | No            |

### Request Service (Port 5002)

| Endpoint          | Method | Description           | Auth Required |
| ----------------- | ------ | --------------------- | ------------- |
| `/`             | GET    | Service health check  | No            |
| `/postRequest`  | POST   | Create help request   | Yes           |
| `/panicRequest` | POST   | Create urgent request | Yes           |
| `/requests`     | GET    | Get user's requests   | Yes           |
| `/requests/:id` | GET    | Get request details   | Yes           |

### Other Services (Ports 5003-5006)

- **Matching Service** (5003): User matching logic between seniors and helpers
- **Notification Service** (5004): Push notifications and messaging
- **Priority Router** (5005): Urgent request routing and escalation
- **Rating Service** (5006): User rating and feedback system

## 🗄️ Database Management Tools

### Available Scripts

| Command                     | Description                             | Port |
| --------------------------- | --------------------------------------- | ---- |
| `npm run db-viewer`       | Local PostgreSQL database viewer        | 3001 |
| `npm run db-viewer-aws`   | AWS RDS database viewer                 | 3002 |
| `npm run test-connection` | Test local database connection          | -    |
| `npm run test-aws`        | Test both local and AWS RDS connections | -    |
| `npm run sync-to-aws`     | Sync local data to AWS RDS              | -    |
| `npm run compare-dbs`     | Compare record counts between databases | -    |

### Database Viewers

Both database viewers provide:

- **Secure Access**: Username/password authentication
- **Table Browsing**: View all tables and their data
- **SQL Execution**: Run custom queries safely
- **Data Export**: Download query results
- **Connection Status**: Real-time database connectivity monitoring

**Default Credentials**:

- Username: `admin`
- Password: `changeme123`

### AWS RDS Integration

The platform includes comprehensive AWS RDS PostgreSQL integration:

- **Automated Sync**: One-command synchronization from local to AWS RDS
- **Connection Testing**: Verify connectivity to both local and cloud databases
- **Data Comparison**: Compare record counts and data integrity
- **Security**: Encrypted connections with proper SSL handling
- **Monitoring**: Real-time sync progress and error handling

## 🔧 Development

### Local Development Setup

```bash
# Install dependencies for each service
cd backend/services/auth-service && npm install
cd ../request-service && npm install
cd ../matching-service && npm install
cd ../notification-service && npm install
cd ../priority-router-service && npm install
cd ../rating-service && npm install

# Install root dependencies for database tools
cd ../../.. && npm install

# Run individual services in development mode
npm run dev  # (if nodemon is configured)

# Start all services with Docker
npm run start-dev  # docker-compose up --build
```

### Development Tools & Scripts

```bash
# Database Management
npm run db-viewer          # Local PostgreSQL viewer (port 3001)
npm run db-viewer-aws      # AWS RDS viewer (port 3002)
npm run test-connection    # Test local database connection
npm run test-aws          # Test both local and AWS RDS connections

# Data Synchronization  
npm run sync-to-aws       # Sync local data to AWS RDS
npm run compare-dbs       # Compare database contents

# Docker Operations
npm start                 # docker-compose up
npm run start-dev         # docker-compose up --build
npm stop                  # docker-compose down
```

### Project Structure Details

```
kampungconnect/
├── README.md                    # Main documentation
├── AWS_RDS_SYNC_GUIDE.md       # AWS RDS integration guide
├── OIDC_SSO_GUIDE.md           # Authentication implementation guide
├── package.json                # Root package with database tools
├── docker-compose.yml          # Container orchestration
├── .env                        # Environment variables (create from template)
├── 
├── setup-aurora-db.js          # AWS Aurora/RDS setup utility
├── sync-to-aws-rds.js          # Database synchronization tool
├── secure-database-viewer.js   # Local database viewer
├── aws-rds-database-viewer.js  # AWS RDS database viewer
├── test-connection.js          # Database connection tester
├── 
├── frontend/                   # Static web application
│   ├── index.html             # Landing page
│   ├── login.html             # Authentication page
│   ├── dashboard.html         # User dashboard
│   ├── requests.html          # Request management
│   ├── role-selection.html    # Role selection page
│   ├── Dockerfile             # Frontend container config
│   ├── nginx.conf             # Nginx configuration
│   ├── css/
│   │   └── style.css         # Custom styles
│   └── js/
│       ├── auth.js           # Authentication manager
│       └── main.js           # Common utilities
├── 
├── backend/
│   ├── services/              # Microservices
│   │   ├── auth-service/      # Authentication & user management
│   │   │   ├── src/
│   │   │   │   ├── index.js
│   │   │   │   ├── database-service.js
│   │   │   │   ├── jwt-utils.js
│   │   │   │   ├── oidc-providers.js
│   │   │   │   └── password-service.js
│   │   │   ├── Dockerfile
│   │   │   └── package.json
│   │   ├── request-service/   # Help request management
│   │   ├── matching-service/  # User matching logic
│   │   ├── notification-service/  # Push notifications
│   │   ├── priority-router-service/  # Urgent request handling
│   │   └── rating-service/    # User rating system
│   ├── shared/               # Common middleware & utilities
│   │   └── auth-middleware.js
│   └── db/                   # Database initialization
│       └── init.sql          # Database schema
└── 
└── public/                   # Public utilities
    └── secure-viewer.html    # Database viewer interface
```

### Database Schema

The application uses PostgreSQL with the following main tables:

```sql
-- Users table: Supports both OAuth and email/password authentication
users (
    id, provider_id, email, firstname, lastname, password_hash,
    picture, provider, role, rating, location, email_verified,
    is_active, created_at, updated_at
)

-- Help requests (normal or urgent)  
requests (
    id, user_id, category, type, description, status, created_at
)

-- Matches (which helper took which request)
matches (
    id, request_id, helper_id, matched_at, status
)

-- Ratings (seniors can rate helpers and vice versa)
ratings (
    id, match_id, rater_id, ratee_id, score, comment, created_at
)
```

**Key Features:**

- **Multi-Provider Auth**: Supports Google, Azure AD and email/password
- **Role-Based Access**: Senior, volunteer, and caregiver roles
- **Request Types**: Normal and urgent requests with different priority handling
- **Rating System**: 5-star rating system with comments for community trust
- **Data Integrity**: Foreign key constraints and proper indexing for performance

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

   - Check browser console for detailed logs
   - Monitor Docker logs: `docker-compose logs -f`

## 🚀 Deployment

### Local Development Deployment

```bash
# Quick start (build and run all services)
npm run start-dev

# Or manually with docker-compose
docker-compose up --build

# Run in background
docker-compose up --build -d

# Check service status
docker-compose ps

# View logs
docker-compose logs -f
```

### AWS RDS Setup & Deployment

1. **Configure AWS RDS Connection**:

   ```bash
   # Copy environment template
   cp .env.local.template .env.local

   # Update .env.local with your AWS RDS credentials
   ```
2. **Test AWS Connection**:

   ```bash
   npm run test-aws
   ```
3. **Sync Local Data to AWS RDS**:

   ```bash
   npm run sync-to-aws
   ```
4. **Monitor AWS RDS Database**:

   ```bash
   npm run db-viewer-aws
   # Access at http://localhost:3002
   ```

### Production Considerations

1. **Environment Variables**:

   - Use strong, unique JWT secrets (256+ bits)
   - Configure HTTPS URLs for OIDC redirects
   - Set secure cookie flags and HTTPS-only mode
   - Use AWS Secrets Manager for sensitive credentials
2. **Database Security**:

   - Enable AWS RDS encryption at rest and in transit
   - Configure VPC security groups to restrict access
   - Use IAM database authentication where possible
   - Regular automated backups and point-in-time recovery
3. **Docker Production**:

   ```bash
   # Production build with specific compose file
   docker-compose -f docker-compose.prod.yml up --build

   # Scale services based on load
   docker-compose up --scale request-service=3 --scale matching-service=2
   ```
4. **Security Hardening**:

   - Enable HTTPS with valid SSL certificates
   - Use a reverse proxy (nginx/ALB) with proper headers
   - Implement rate limiting and DDoS protection
   - Regular security updates and vulnerability scanning
   - Monitor authentication logs and set up alerting
5. **AWS Integration**:

   - Use Application Load Balancer for high availability
   - Configure Auto Scaling Groups for services
   - Set up CloudWatch monitoring and alarms
   - Use AWS RDS Multi-AZ for database redundancy

## 🔧 Troubleshooting

### Common Issues

| Issue                                    | Solution                                              |
| ---------------------------------------- | ----------------------------------------------------- |
| **"OIDC provider not configured"** | Check `.env` file and provider credentials          |
| **"Authentication failed"**        | Verify redirect URIs in provider settings             |
| **"Token validation failed"**      | Ensure JWT_SECRET is consistent across services       |
| **"CORS errors"**                  | Check FRONTEND_URL configuration                      |
| **Infinite redirect loop**         | Clear browser cookies and tokens                      |
| **Database connection failed**     | Verify PostgreSQL is running:`docker-compose ps db` |
| **AWS RDS connection timeout**     | Check security groups and network connectivity        |
| **Database viewer login failed**   | Use default credentials: admin/changeme123            |

### Debug Tools & Utilities

- **Local Database Viewer**: `npm run db-viewer` → http://localhost:3001
- **AWS RDS Database Viewer**: `npm run db-viewer-aws` → http://localhost:3002
- **Connection Testing**: `npm run test-connection` (local), `npm run test-aws` (both)
- **Database Comparison**: `npm run compare-dbs`
- **Browser Console**: Enable verbose logging for frontend debugging
- **Docker Logs**: `docker-compose logs [service-name]`

### Database Issues

```bash
# Test local database connection
npm run test-connection

# Test AWS RDS connection  
npm run test-aws

# Compare database contents
npm run compare-dbs

# Reset local database
docker-compose down -v  # Remove volumes
docker-compose up --build  # Recreate with fresh data
```

### Service Health Monitoring

```bash
# View all service logs
docker-compose logs -f

# View specific service logs
docker-compose logs -f auth-service
docker-compose logs -f db

# Check service health
docker-compose ps

# Restart specific service
docker-compose restart auth-service

# Rebuild and restart all services
docker-compose down && docker-compose up --build
```

### AWS RDS Troubleshooting

```bash
# Verify AWS RDS connectivity
npm run test-aws

# Check sync status
npm run sync-to-aws

# Monitor AWS database
npm run db-viewer-aws
```

**Common AWS RDS Issues:**

- **Security Group**: Ensure inbound rule allows PostgreSQL (port 5432) from your IP
- **VPC Settings**: Verify RDS instance is publicly accessible if connecting externally
- **Credentials**: Double-check username/password in `.env.local`
- **SSL**: Connection uses SSL by default; check certificate requirements

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature-name`
3. Make your changes and test thoroughly
4. Test authentication flows and database operations
5. Commit: `git commit -m "Add feature: description"`
6. Push: `git push origin feature-name`
7. Create a Pull Request with detailed description

### Development Guidelines

- **Code Quality**: Follow RESTful API conventions and consistent code style
- **Error Handling**: Add comprehensive error handling and logging
- **Testing**: Test both local and AWS RDS database operations
- **Authentication**: Verify OIDC integration works with all providers
- **Documentation**: Update relevant guides (README, OIDC_SSO_GUIDE, AWS_RDS_SYNC_GUIDE)
- **Database Changes**: Update schema in `backend/db/init.sql` and sync tools
- **Security**: Follow security best practices for authentication and data handling

### Before Submitting

```bash
# Test local environment
npm run start-dev
npm run test-connection

# Test AWS integration (if configured)
npm run test-aws
npm run compare-dbs

# Verify all services are working
docker-compose ps
docker-compose logs --tail=50

# Test database viewers
npm run db-viewer      # Local PostgreSQL
npm run db-viewer-aws  # AWS RDS (if configured)
```

## 📚 Additional Resources

### Project Documentation

- **[OIDC Implementation Guide](./OIDC_SSO_GUIDE.md)** - Comprehensive authentication setup and troubleshooting
- **[AWS RDS Sync Guide](./AWS_RDS_SYNC_GUIDE.md)** - Database synchronization and AWS integration

### External Documentation

- [OpenID Connect Specification](https://openid.net/connect/) - OIDC standards and best practices
- [Docker Compose Documentation](https://docs.docker.com/compose/) - Container orchestration
- [Express.js Guide](https://expressjs.com/) - Backend framework documentation
- [PostgreSQL Documentation](https://www.postgresql.org/docs/) - Database management
- [AWS RDS PostgreSQL](https://docs.aws.amazon.com/rds/latest/userguide/CHAP_PostgreSQL.html) - Cloud database setup

### Development Tools

- [JWT.io](https://jwt.io/) - Token decoder and validator
- [OAuth 2.0 Playground](https://developers.google.com/oauthplayground) - Test OAuth flows
- [Postman](https://www.postman.com/) - API testing and documentation

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
