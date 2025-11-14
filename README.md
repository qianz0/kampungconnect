# KampungConnect 🏘️

A comprehensive community-driven platform that connects seniors with local helpers for daily assistance, built with modern web technologies, secure authentication, social networking features, and enterprise-grade observability.

## 📋 Overview

KampungConnect is a microservices-based web application that facilitates community support by allowing seniors ("Khakis") to request help and connecting them with willing community helpers. The platform emphasizes security, scalability, social connectivity, and user-friendly design with full monitoring capabilities.

### Key Features

- 🔐 **Secure Authentication** - Multiple authentication methods:
  - OIDC/SSO integration with Google and Azure AD
  - Email/Password authentication with OTP verification
  - JWT-based session management
- 👥 **Social Networking** - Built-in social features:
  - Friend requests and friend management
  - Real-time messaging system (gRPC-powered)
  - User profiles with ratings and statistics
  - Leaderboards for top helpers
- 🤝 **Intelligent Matching** - Smart matching system between seniors and helpers based on:
  - Geographic proximity (postal code-based)
  - Request categories and helper expertise
  - Availability and ratings
  - Urgency levels
- 📱 **Responsive Design** - Mobile-first interface built with Bootstrap 5
- 🔔 **Real-time Notifications** - Email notifications for:
  - Friend requests and acceptances
  - New messages and match updates
  - Request status changes
  - Rating submissions
- ⭐ **Rating System** - Community trust through comprehensive ratings and reviews
- 🚨 **Priority Routing** - Urgent/panic requests get immediate attention
- 🐳 **Containerized** - Docker images with Kubernetes orchestration
- ☸️ **Production-Ready** - Full Kubernetes deployment with secrets management
- 📊 **Observability Stack** - Integrated monitoring with Prometheus, Grafana, and Tempo
- 📨 **Message Queue** - RabbitMQ for async processing and service communication
- 🔍 **Admin Dashboard** - Comprehensive admin panel for user and request management

## 🏗️ Architecture

### Microservices Structure

```
kampungconnect/
├── frontend/                 # Static web application (Nginx)
│   ├── css/                 # Stylesheets
│   │   ├── header.css
│   │   ├── helper-ratings.css
│   │   └── rate-helper.css
│   ├── js/                  # JavaScript modules
│   │   ├── auth.js          # Authentication manager with JWT handling
│   │   ├── config.js        # API endpoints configuration
│   │   ├── header.js        # Reusable header component
│   │   ├── main.js          # Common utilities
│   │   ├── admin.js         # Admin dashboard functionality
│   │   ├── notifications.js # Notification handling
│   │   ├── postal-utils.js  # Singapore postal code utilities
│   │   ├── rate-helper.js   # Rating interface
│   │   └── stats.js         # Statistics display
│   ├── components/
│   │   └── header.html      # Reusable navigation header
│   ├── index.html           # Landing page
│   ├── login.html           # Authentication page
│   ├── role-selection.html  # Role selection for new users
│   ├── verify-email.html    # Email verification with OTP
│   ├── reset-password.html  # Password reset
│   ├── dashboard.html       # User dashboard
│   ├── profile.html         # User profile management
│   ├── requests.html        # Browse help requests
│   ├── all-requests.html    # All requests (admin view)
│   ├── my-requests.html     # My posted requests
│   ├── request-details.html # Single request view
│   ├── match.html           # Senior matching interface
│   ├── match-helper.html    # Helper matching interface
│   ├── task-completed.html  # Task completion confirmation
│   ├── rate-helper.html     # Rate helper after task
│   ├── helper-profile.html  # Helper profile with ratings
│   ├── khakis.html          # Browse khakis (seniors) near me
│   ├── khaki-profile.html   # Khaki profile view
│   ├── friends.html         # Friend management & requests
│   ├── messages.html        # Real-time messaging interface
│   ├── my-stats.html        # Personal statistics
│   ├── leaderboard.html     # Helper leaderboard
│   ├── notifications.html   # Notifications center
│   ├── admin.html           # Admin dashboard
│   ├── Dockerfile           # Frontend container config
│   └── nginx.conf           # Nginx configuration
├── backend/
│   ├── services/
│   │   ├── auth-service/           # Port 5000 (5001 external)
│   │   │   ├── src/
│   │   │   │   ├── index.js
│   │   │   │   ├── database-service.js
│   │   │   │   ├── jwt-utils.js
│   │   │   │   ├── oidc-providers.js  # Google & Azure AD
│   │   │   │   ├── otp-service.js     # Email OTP verification
│   │   │   │   └── password-service.js # Password hashing
│   │   │   ├── create-admin.js         # Admin creation utility
│   │   │   ├── start.sh                # Service startup script
│   │   │   ├── Dockerfile
│   │   │   └── package.json
│   │   ├── request-service/         # Port 5000 (5002 external)
│   │   │   ├── src/
│   │   │   │   ├── index.js
│   │   │   │   ├── db.js
│   │   │   │   ├── queue.js            # RabbitMQ integration
│   │   │   │   └── tracing.js          # OpenTelemetry tracing
│   │   │   ├── Dockerfile
│   │   │   └── package.json
│   │   ├── matching-service/        # Port 5000 (5003 external)
│   │   │   ├── src/
│   │   │   │   ├── index.js
│   │   │   │   ├── db.js
│   │   │   │   ├── matcher.js          # Matching algorithm
│   │   │   │   ├── postal-utils.js     # Postal code distance
│   │   │   │   ├── queue.js
│   │   │   │   └── tracing.js
│   │   │   ├── Dockerfile
│   │   │   └── package.json
│   │   ├── notification-service/    # Port 5000 (5004 external)
│   │   │   ├── src/
│   │   │   │   ├── index.js
│   │   │   │   └── smtp-service.js     # Email via Gmail SMTP
│   │   │   ├── Dockerfile
│   │   │   └── package.json
│   │   ├── rating-service/          # Port 5000 (5006 external)
│   │   │   ├── src/
│   │   │   │   ├── index.js
│   │   │   │   ├── db.js
│   │   │   │   ├── controllers/        # Rating CRUD operations
│   │   │   │   └── routes/
│   │   │   ├── Dockerfile
│   │   │   └── package.json
│   │   ├── admin-service/           # Port 5000 (5007 external)
│   │   │   ├── src/
│   │   │   │   └── index.js
│   │   │   ├── Dockerfile
│   │   │   └── package.json
│   │   ├── social-service/          # Port 5008 REST, 50051 gRPC
│   │   │   ├── src/
│   │   │   │   ├── index.js
│   │   │   │   └── db.js
│   │   │   ├── proto/
│   │   │   │   └── messaging.proto     # gRPC messaging protocol
│   │   │   ├── Dockerfile
│   │   │   └── package.json
│   │   └── stats-service/           # Port 5000 (5009 external)
│   │       ├── src/
│   │       │   ├── index.js
│   │       │   └── db.js
│   │       ├── Dockerfile
│   │       └── package.json
│   ├── shared/                      # Common middleware
│   │   └── auth-middleware.js       # JWT authentication
│   └── db/                          # Database initialization
│       └── init.sql                 # Database schema & seed data
├── k8s/                      # Kubernetes manifests
│   ├── base/
│   │   └── namespace.yaml           # kampungconnect namespace
│   ├── infra/                       # Infrastructure services
│   │   ├── db.yaml                  # PostgreSQL StatefulSet
│   │   ├── rabbitmq.yaml            # RabbitMQ StatefulSet
│   │   ├── prometheus.yaml          # Metrics collection
│   │   ├── grafana.yaml             # Dashboards & visualization
│   │   ├── tempo.yaml               # Distributed tracing
│   │   └── otel-collector.yaml      # OpenTelemetry collector
│   ├── secrets/                     # Kubernetes secrets
│   │   └── smtp-secret.yaml         # SMTP credentials (gitignored)
|   |   └── smtp-secret-example.yaml # SMTP credentials example
│   └── services/                    # Application deployments
│       ├── auth-service.yaml
│       ├── request-service.yaml
│       ├── matching-service.yaml
│       ├── notification-service.yaml
│       ├── rating-service.yaml
│       ├── admin-service.yaml
│       ├── social-service.yaml
│       ├── stats-service.yaml
│       └── frontend.yaml
├── build-all.bat             # Build all Docker images
├── deploy-to-kuber.bat       # Deploy to Kubernetes cluster
├── deploy-all.bat            # Complete build + deploy workflow
├── port-forward.ps1          # Start all port forwards (PowerShell)
├── reset-database.bat        # Reset and reinitialize database
└── .gitignore                # Git ignore file (includes k8s/secrets/)
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
- PostgreSQL database with connection pooling
- JWT for authentication tokens
- Passport.js for OIDC integration (Google, Azure AD)
- NodeMailer for email notifications via Gmail SMTP
- RabbitMQ for message queuing and async processing
- gRPC for real-time messaging service communication
- 8 specialized microservices:
  - **auth-service**: User authentication, registration, OIDC, OTP verification
  - **request-service**: Help request CRUD and management
  - **matching-service**: Intelligent helper-senior matching algorithm
  - **notification-service**: Email notifications for all events
  - **rating-service**: User ratings and reviews management
  - **admin-service**: Admin dashboard with statistics and management
  - **social-service**: Friend requests, messaging (REST + gRPC)
  - **stats-service**: User statistics, leaderboards, achievements

**Infrastructure:**

- Kubernetes for container orchestration
- Docker for containerization
- PostgreSQL for data persistence
- RabbitMQ for async messaging
- OpenTelemetry for distributed tracing

**Observability:**

- Prometheus for metrics collection
- Grafana for visualization dashboards
- Tempo for distributed tracing
- OpenTelemetry Collector for trace aggregation

## 🚀 Quick Start

### Prerequisites

- Kubernetes cluster (minikube, Docker Desktop, or cloud provider)
- kubectl configured and connected to your cluster
- Docker installed for building images
- An OIDC provider account (Google/Azure AD)
- Basic knowledge of Kubernetes and environment variables

### 1. Clone the Repository

```bash
git clone https://github.com/qianz0/kampungconnect.git
cd kampungconnect
```

### 2. Configure Environment Variables

Create a `.env` file in the project root or configure as Kubernetes secrets:

```env
# Database Configuration
POSTGRES_HOST=db
POSTGRES_PORT=5432
POSTGRES_DB=kampungconnect
POSTGRES_USER=admin
POSTGRES_PASSWORD=your-secure-password

# RabbitMQ Configuration
RABBITMQ_HOST=rabbitmq
RABBITMQ_PORT=5672
RABBITMQ_USER=admin
RABBITMQ_PASSWORD=your-rabbitmq-password

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

# SMTP Configuration (for email notifications and OTP)
# Stored as Kubernetes secret: k8s/secrets/smtp-secret.yaml
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-gmail-app-password
SMTP_FROM_EMAIL=your-email@gmail.com
SMTP_FROM_NAME=KampungConnect

# Application URLs
FRONTEND_URL=http://localhost:8080
AUTH_SERVICE_URL=http://auth-service:5000

# OpenTelemetry Configuration
OTEL_EXPORTER_OTLP_ENDPOINT=http://otel-collector:4318
OTEL_SERVICE_NAME=kampungconnect
```

**Important Security Notes:**

- SMTP credentials should be stored in `k8s/secrets/smtp-secret.yaml` (not committed to git)
- The `k8s/secrets/` directory is gitignored for security
- Create secrets with: `kubectl apply -f k8s/secrets/smtp-secret.yaml`

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

### 4. Build and Deploy

**Option 1: Automated Deployment (Recommended)**

```bash
# Windows - Run complete deployment
deploy-all.bat
```

This will:

1. Build all 8 Docker images for each microservice
2. Create Kubernetes namespace (`kampungconnect`)
3. Create SMTP secrets (requires `k8s/secrets/smtp-secret.yaml`)
4. Deploy infrastructure (PostgreSQL, RabbitMQ, monitoring stack)
5. Deploy all 8 microservices + frontend
6. Wait for pods to be ready
7. Run database initialization job

**Note:** Create SMTP secrets first:

```bash
# Create k8s/secrets/smtp-secret.yaml with your credentials
kubectl apply -f k8s/secrets/smtp-secret.yaml
```

**Option 2: Manual Step-by-Step**

```bash
# Step 1: Build all Docker images
build-all.bat

# Step 2: Deploy to Kubernetes
deploy-to-kuber.bat

# Step 3: Wait for all pods to be running
kubectl get pods -n kampungconnect -w
# Press Ctrl+C when all pods show STATUS: Running
```

### 5. Start Port Forwarding

**PowerShell (Recommended - runs in background):**

```powershell
# Start all port forwards in background, ctrl C to stop
.\port-forward.ps1

# Check status
Get-Job
```

**Batch File (opens separate windows):**

```cmd
port-forward.ps1
```

### 6. Access the Application

**Frontend & Monitoring:**

- **Frontend**: http://localhost:8080
- **RabbitMQ Management**: http://localhost:15672 (guest/guest)
- **Prometheus**: http://localhost:9090
- **Grafana**: http://localhost:3000 (admin/admin)
- **Tempo**: http://localhost:3200

**Backend Services:**

- **Auth Service**: http://localhost:5001 (OIDC, registration, OTP verification)
- **Request Service**: http://localhost:5002 (help requests)
- **Matching Service**: http://localhost:5003 (matching algorithm)
- **Notification Service**: http://localhost:5004 (email notifications)
- **Rating Service**: http://localhost:5006 (ratings & reviews)
- **Admin Service**: http://localhost:5007 (admin dashboard)
- **Social Service**: http://localhost:5008 (friends, messaging, activities)
- **Stats Service**: http://localhost:5009 (statistics & leaderboards)

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

### Matching Service (Port 5003)

| Endpoint                  | Method | Description                   | Auth Required |
| ------------------------- | ------ | ----------------------------- | ------------- |
| `/`                     | GET    | Service health check          | No            |
| `/metrics`              | GET    | Prometheus metrics            | No            |
| `/matches`              | GET    | Get all matches (admin/debug) | Yes           |
| `/matches/senior`       | GET    | Get senior's matches          | Yes           |
| `/matches/helper`       | GET    | Get helper's matches          | Yes           |
| `/helpers/available`    | GET    | Get available helpers         | Yes           |
| `/matches/assign`       | POST   | Manual match assignment       | Yes           |
| `/matches/:id/complete` | POST   | Mark match as complete        | Yes           |

### Notification Service (Port 5004)

| Endpoint                      | Method | Description                        | Auth Required |
| ----------------------------- | ------ | ---------------------------------- | ------------- |
| `/`                         | GET    | Service health check               | No            |
| `/health`                   | GET    | Detailed health status             | No            |
| `/notification-preferences` | GET    | Get user notification preferences  | Yes           |
| `/notification-preferences` | POST   | Update notification preferences    | Yes           |
| `/notify/offer`             | POST   | Send offer notification (internal) | No            |
| `/notify/match`             | POST   | Send match notification (internal) | No            |
| `/notify/instant-match`     | POST   | Send instant match notification    | No            |
| `/notify/status-update`     | POST   | Send status update notification    | No            |

### Rating Service (Port 5006)

| Endpoint                            | Method | Description                      | Auth Required |
| ----------------------------------- | ------ | -------------------------------- | ------------- |
| `/`                               | GET    | Service health check             | No            |
| `/api/ratings`                    | POST   | Submit a new rating              | Yes           |
| `/api/ratings/helper/:helperId`   | GET    | Get helper's ratings             | Yes           |
| `/api/ratings/helper-profile/:id` | GET    | Get helper profile with ratings  | Yes           |
| `/api/ratings/my-ratings`         | GET    | Get my submitted ratings         | Yes           |
| `/api/ratings/:ratingId`          | PUT    | Update existing rating           | Yes           |
| `/api/ratings/:ratingId`          | DELETE | Delete a rating                  | Yes           |
| `/api/ratings/pending-ratings`    | GET    | Get pending ratings              | Yes           |
| `/api/ratings/complete-match/:id` | POST   | Complete match (triggers rating) | Yes           |

### Admin Service (Port 5007)

| Endpoint                                   | Method | Description                     | Auth Required | Admin Only |
| ------------------------------------------ | ------ | ------------------------------- | ------------- | ---------- |
| `/`                                      | GET    | Service health check            | No            | No         |
| `/api/admin/stats/overview`              | GET    | Dashboard overview statistics   | Yes           | Yes        |
| `/api/admin/stats/urgency-distribution`  | GET    | Urgency distribution stats      | Yes           | Yes        |
| `/api/admin/stats/category-distribution` | GET    | Category distribution stats     | Yes           | Yes        |
| `/api/admin/stats/activity-timeline`     | GET    | Activity timeline (30 days)     | Yes           | Yes        |
| `/api/admin/stats/role-distribution`     | GET    | Role distribution stats         | Yes           | Yes        |
| `/api/admin/stats/status-distribution`   | GET    | Status distribution stats       | Yes           | Yes        |
| `/api/admin/stats/rating-distribution`   | GET    | Rating distribution stats       | Yes           | Yes        |
| `/api/admin/users`                       | GET    | Get all users (with filters)    | Yes           | Yes        |
| `/api/admin/users/:id`                   | GET    | Get user details                | Yes           | Yes        |
| `/api/admin/users/:id/status`            | PATCH  | Update user status              | Yes           | Yes        |
| `/api/admin/users/:id/role`              | PATCH  | Update user role                | Yes           | Yes        |
| `/api/admin/requests`                    | GET    | Get all requests (with filters) | Yes           | Yes        |
| `/api/admin/requests/:id`                | GET    | Get request details             | Yes           | Yes        |
| `/api/admin/requests/:id/status`         | PATCH  | Update request status           | Yes           | Yes        |
| `/api/admin/matches`                     | GET    | Get all matches (with filters)  | Yes           | Yes        |
| `/api/admin/ratings`                     | GET    | Get all ratings (with filters)  | Yes           | Yes        |
| `/api/admin/export/users`                | GET    | Export users as CSV             | Yes           | Yes        |
| `/api/admin/export/requests`             | GET    | Export requests as CSV          | Yes           | Yes        |

### Stats Service (Port 5009)

| Endpoint                              | Method | Description                                              | Auth Required |
| ------------------------------------- | ------ | -------------------------------------------------------- | ------------- |
| `/`                                 | GET    | Service health check                                     | No            |
| `/stats/helper`                     | GET    | Get current user's helper stats                          | Yes           |
| `/stats/helper/:id`                 | GET    | Get specific helper's stats                              | Yes           |
| `/stats/senior`                     | GET    | Get current user's senior stats                          | Yes           |
| `/stats/senior/:id`                 | GET    | Get specific senior's stats                              | Yes           |
| `/stats/leaderboard/:type`          | GET    | Get leaderboard (type: completed, rating, hours, streak) | Yes           |
| `/stats/leaderboard/:type/position` | GET    | Get current user's leaderboard position                  | Yes           |

### Social Service (Port 5008)

**Friend Management Endpoints:**

| Endpoint                    | Method | Description                     | Auth Required |
| --------------------------- | ------ | ------------------------------- | ------------- |
| `/`                       | GET    | Service health check            | No            |
| `/friends`                | GET    | Get user's friends list         | Yes           |
| `/friends/requests`       | GET    | Get received friend requests    | Yes           |
| `/friends/sent`           | GET    | Get sent friend requests        | Yes           |
| `/friends/request`        | POST   | Send friend request             | Yes           |
| `/friends/accept/:id`     | POST   | Accept friend request           | Yes           |
| `/friends/reject/:id`     | POST   | Reject friend request           | Yes           |
| `/friends/cancel/:id`     | POST   | Cancel sent friend request      | Yes           |
| `/friends/:id`            | DELETE | Remove friend                   | Yes           |
| `/friends/status/:userId` | GET    | Get friendship status with user | Yes           |

**Messaging Endpoints (REST API):**

| Endpoint                    | Method | Description                     | Auth Required |
| --------------------------- | ------ | ------------------------------- | ------------- |
| `/messages/conversations` | GET    | Get all conversations           | Yes           |
| `/messages/:userId`       | GET    | Get messages with specific user | Yes           |
| `/messages`               | POST   | Send a message                  | Yes           |
| `/messages/unread/count`  | GET    | Get unread message count        | Yes           |
| `/users/:userId`          | GET    | Get user details (for friends)  | Yes           |

**Activity Planning Endpoints:**

| Endpoint                    | Method | Description                | Auth Required |
| --------------------------- | ------ | -------------------------- | ------------- |
| `/activities`             | GET    | Get user's activities      | Yes           |
| `/activities/:id`         | GET    | Get activity details       | Yes           |
| `/activities`             | POST   | Create new activity        | Yes           |
| `/activities/:id`         | PUT    | Update activity            | Yes           |
| `/activities/:id`         | DELETE | Cancel activity            | Yes           |
| `/activities/:id/join`    | POST   | Join an activity           | Yes           |
| `/activities/:id/leave`   | POST   | Leave an activity          | Yes           |
| `/activities/:id/respond` | POST   | Respond to activity invite | Yes           |

**gRPC Endpoints (Port 50051):**

- Real-time messaging streams
- Message delivery notifications
- Typing indicators
- Presence updates

## 🌐 Social Features

KampungConnect includes comprehensive social networking features to build community connections:

### Friend System

- **Friend Requests**: Send and receive friend requests
- **Friend Management**: Accept, reject, or remove friends
- **Friendship Status**: Check friendship status with any user
- **Friend List**: View all your connections with profile information

### Real-Time Messaging

- **Direct Messages**: One-on-one messaging with friends
- **Conversation History**: Access full message history
- **Unread Indicators**: Track unread messages
- **Message Notifications**: Email alerts for new messages
- **REST + gRPC**: REST API for CRUD, gRPC for real-time features

### User Profiles

- **Profile Viewing**: View khaki (senior) profiles
- **Browse Khakis**: Find seniors near you by postal code
- **Helper Profiles**: View helper ratings and statistics
- **Profile Pictures**: Avatar support with fallback initials

### Social Discovery

- **Nearby Khakis**: Location-based user discovery
- **Search & Filter**: Find users by name, location, or rating
- **Leaderboards**: View top-rated helpers in the community
- **Statistics**: Track your social impact and engagement

## 📊 Monitoring & Observability

### Prometheus Metrics

Access metrics at http://localhost:9090

**Available Metrics:**

- HTTP request counts and durations
- Database connection pool status
- RabbitMQ queue depths
- Service health status
- Error rates and latencies

**Example Queries:**

```promql
# Request rate per service
rate(http_requests_total[5m])

# 95th percentile latency
histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))

# Error rate
rate(http_requests_total{status=~"5.."}[5m])
```

### Grafana Dashboards

Access dashboards at http://localhost:3000 (admin/admin)

**Pre-configured Dashboards:**

- Service Overview: Request rates, latencies, error rates
- Database Metrics: Connection pools, query performance
- RabbitMQ: Queue depths, message rates, consumer status
- System Resources: CPU, memory, network usage

### Distributed Tracing

Access traces at http://localhost:3200

**Features:**

- End-to-end request tracing across all microservices
- Visualize service dependencies
- Identify performance bottlenecks
- Debug distributed transactions

### RabbitMQ Management

Access management UI at http://localhost:15672 (guest/guest)

**Monitoring:**

- Queue depths and message rates
- Consumer status and connections
- Exchange configurations
- Message routing visualization

## 🔧 Development

### Local Development Setup

```bash
# Install dependencies for each service
cd backend/services/auth-service && npm install
cd ../request-service && npm install
cd ../matching-service && npm install
cd ../notification-service && npm install
cd ../rating-service && npm install
cd ../admin-service && npm install
cd ../stats-service && npm install
```

### Development Workflow

```bash
# 1. Make code changes to any service
# 2. Rebuild Docker images
build-all.bat

# 3. Redeploy to Kubernetes
kubectl rollout restart deployment -n kampungconnect

# 4. Watch pods restart
kubectl get pods -n kampungconnect -w

# 5. View logs of specific service
kubectl logs -f deployment/auth-service -n kampungconnect
```

### Kubernetes Commands

```bash
# View all pods
kubectl get pods -n kampungconnect

# View all services
kubectl get svc -n kampungconnect

# View pod logs
kubectl logs -f <pod-name> -n kampungconnect

# Describe pod (for troubleshooting)
kubectl describe pod <pod-name> -n kampungconnect

# Execute command in pod
kubectl exec -it <pod-name> -n kampungconnect -- /bin/sh

# Port forward to specific pod (alternative to scripts)
kubectl port-forward -n kampungconnect svc/frontend 8080:80

# View resource usage
kubectl top pods -n kampungconnect

# Delete and recreate everything
kubectl delete namespace kampungconnect
deploy-to-kuber.bat
```

### Available Scripts & Tools

| Script/Command              | Description                                    |
| --------------------------- | ---------------------------------------------- |
| `build-all.bat`           | Build all Docker images                        |
| `deploy-to-kuber.bat`     | Deploy to Kubernetes (creates secrets, deploys |
| `deploy-all.bat`          | Full workflow: build + deploy                  |
| `port-forward.ps1`        | Start/stop all port forwards (PowerShell)      |
| `kubectl get pods -n ...` | View pod status                                |
| `kubectl logs -f ...`     | View service logs                              |
| `kubectl rollout restart` | Restart deployments after code changes         |

### Project Structure Details

```
kampungconnect/
├── README.md                      # Main documentation
├── 
├── .env                          # Environment variables (create from .env.example)
├── .env.example                  # Environment template
├── 
├── build-all.bat                 # Build all Docker images
├── deploy-to-kuber.bat           # Deploy to Kubernetes
├── deploy-all.bat                # Complete deployment workflow
├── port-forward.ps1              # Port forwarding (PowerShell)
├── 
├── frontend/                     # Static web application
│   ├── index.html               # Landing page
│   ├── login.html               # Authentication page
│   ├── dashboard.html           # User dashboard
│   ├── requests.html            # Request management
│   ├── match.html               # Helper matching
│   ├── notifications.html       # Notifications center
│   ├── profile.html             # User profile
│   ├── leaderboard.html         # Helper rankings
│   ├── admin.html               # Admin panel
│   ├── Dockerfile               # Frontend container config
│   ├── nginx.conf               # Nginx configuration
│   ├── css/
│   │   ├── header.css
│   │   ├── helper-ratings.css
│   │   └── rate-helper.css
│   ├── js/
│   │   ├── auth.js              # Authentication manager
│   │   ├── config.js            # API configuration
│   │   ├── main.js              # Common utilities
│   │   ├── admin.js             # Admin functionality
│   │   ├── notifications.js     # Notifications handler
│   │   └── stats.js             # Statistics display
│   └── components/
│       └── header.html          # Reusable header component
├── 
├── backend/
│   ├── services/                # Microservices
│   │   ├── auth-service/        # Authentication & user management
│   │   │   ├── src/
│   │   │   │   ├── index.js
│   │   │   │   ├── database-service.js
│   │   │   │   ├── jwt-utils.js
│   │   │   │   ├── oidc-providers.js
│   │   │   │   ├── otp-service.js
│   │   │   │   └── password-service.js
│   │   │   ├── create-admin.js  # Admin creation utility
│   │   │   ├── start.sh         # Service startup script
│   │   │   ├── Dockerfile
│   │   │   └── package.json
│   │   ├── request-service/     # Help request management
│   │   │   ├── src/
│   │   │   │   ├── index.js
│   │   │   │   ├── db.js
│   │   │   │   ├── queue.js     # RabbitMQ integration
│   │   │   │   └── tracing.js   # OpenTelemetry tracing
│   │   │   ├── Dockerfile
│   │   │   └── package.json
│   │   ├── matching-service/    # User matching logic
│   │   │   ├── src/
│   │   │   │   ├── index.js
│   │   │   │   ├── db.js
│   │   │   │   ├── matcher.js   # Matching algorithm
│   │   │   │   ├── postal-utils.js
│   │   │   │   ├── queue.js
│   │   │   │   └── tracing.js
│   │   │   ├── Dockerfile
│   │   │   └── package.json
│   │   ├── notification-service/ # Email notifications
│   │   │   ├── src/
│   │   │   │   ├── index.js
│   │   │   │   └── smtp-service.js
│   │   │   ├── Dockerfile
│   │   │   └── package.json
│   │   ├── rating-service/      # User rating system
│   │   │   ├── src/
│   │   │   │   ├── index.js
│   │   │   │   ├── db.js
│   │   │   │   ├── controllers/ # Rating operations
│   │   │   │   └── routes/
│   │   │   ├── Dockerfile
│   │   │   └── package.json
│   │   ├── admin-service/       # Admin operations
│   │   │   ├── src/
│   │   │   │   └── index.js
│   │   │   ├── Dockerfile
│   │   │   └── package.json
│   │   └── stats-service/       # Statistics & analytics
│   │       ├── src/
│   │       │   ├── index.js
│   │       │   └── db.js
│   │       ├── Dockerfile
│   │       └── package.json
│   ├── shared/                  # Common middleware
│   │   └── auth-middleware.js   # JWT authentication
│   └── db/                      # Database initialization
│       └── init.sql             # Database schema
└── 
└── k8s/                         # Kubernetes manifests
    ├── base/
    │   └── namespace.yaml       # Namespace definition
    ├── infra/                   # Infrastructure components
    │   ├── db.yaml              # PostgreSQL deployment
    │   ├── rabbitmq.yaml        # RabbitMQ deployment
    │   ├── prometheus.yaml      # Prometheus monitoring
    │   ├── grafana.yaml         # Grafana dashboards
    │   ├── tempo.yaml           # Tempo tracing
    │   └── otel-collector.yaml  # OpenTelemetry Collector
    └── services/                # Application services
        ├── auth-service.yaml
        ├── request-service.yaml
        ├── matching-service.yaml
        ├── notification-service.yaml
        ├── rating-service.yaml
        ├── admin-service.yaml
        ├── stats-service.yaml
        └── frontend.yaml
```

### Database Schema

The application uses PostgreSQL with the following main tables:

```sql
-- Users table: Supports both OAuth and email/password authentication
users (
    id, provider_id, email, firstname, lastname, password_hash,
    picture, provider, role, rating, location, postal_code,
    email_verified, is_active, created_at, updated_at, last_login
)

-- Help requests
requests (
    id, user_id, helper_id, category, type, description, 
    status, location, postal_code, urgency_level,
    created_at, updated_at, completed_at
)

-- Matches between helpers and requests
matches (
    id, request_id, helper_id, senior_id, matched_at, 
    completed_at, status, match_type
)

-- Ratings for completed matches
ratings (
    id, match_id, rater_id, ratee_id, score, comment, 
    helpful_count, created_at, updated_at
)

-- OTP tokens for email verification
otp_tokens (
    id, user_id, email, token, expires_at, attempts,
    created_at, is_used
)

-- Friend relationships
friendships (
    id, user_id, friend_id, status, created_at, 
    accepted_at, updated_at
)

-- Friend requests
friend_requests (
    id, sender_id, receiver_id, status, message,
    created_at, responded_at
)

-- Messages (for direct messaging)
messages (
    id, conversation_id, sender_id, receiver_id, 
    content, read, created_at, updated_at
)

-- Activities (social events)
activities (
    id, creator_id, title, description, location,
    scheduled_at, status, max_participants,
    created_at, updated_at
)

-- Activity participants
activity_participants (
    id, activity_id, user_id, status, 
    joined_at, response
)
```

**Key Features:**

- **Multi-Provider Auth**: Supports Google, Azure AD, and email/password with OTP verification
- **Role-Based Access**: Senior (Khaki), helper, and admin roles with different permissions
- **Social Networking**: Friends and messaging fully integrated
- **Geographic Matching**: Postal code-based proximity matching for Singapore addresses
- **Urgency Levels**: Normal and panic requests with different priority handling
- **Rating System**: Bidirectional 5-star rating system with comments and helpful votes
- **Real-Time Messaging**: gRPC-powered messaging with conversation tracking
- **Email Verification**: OTP-based email verification with attempt limits (3 max)
- **Data Integrity**: Foreign key constraints, proper indexing, and transaction support

## 🔒 Security Features

- **OIDC/OAuth2**: Industry-standard authentication
- **JWT Tokens**: Secure session management
- **CORS Protection**: Cross-origin request security
- **Input Validation**: SQL injection prevention
- **Rate Limiting**: API abuse protection
- **Secure Headers**: XSS and CSRF protection

## 🧪 Testing

### Health Checks

All services expose health check endpoints:

```bash
# Check service health via port-forwards
curl http://localhost:5001/  # Auth service
curl http://localhost:5002/  # Request service
curl http://localhost:5003/  # Matching service
curl http://localhost:5004/  # Notification service
curl http://localhost:5006/  # Rating service
curl http://localhost:5007/  # Admin service
curl http://localhost:5008/  # Social service
curl http://localhost:5009/  # Stats service
```

### API Testing

```bash
# Test authentication endpoint
curl http://localhost:5001/auth-config

# Test authenticated endpoint (requires JWT token)
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
     http://localhost:5001/me

# Test request creation
curl -X POST http://localhost:5002/postRequest \
     -H "Authorization: Bearer YOUR_JWT_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"category":"groceries","description":"Need help with shopping"}'

# Test friend requests
curl http://localhost:5008/friends \
     -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Test messaging
curl http://localhost:5008/messages/conversations \
     -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

    -H "Content-Type: application/json"
    -d '{"category":"groceries","description":"Need help with shopping"}'

```

### Kubernetes Testing

```bash
# Check pod health
kubectl get pods -n kampungconnect

# Check pod logs for errors
kubectl logs deployment/auth-service -n kampungconnect

# Check service endpoints
kubectl get svc -n kampungconnect

# Test database connectivity
kubectl exec -it deployment/auth-service -n kampungconnect -- \
    psql -h postgres -U admin -d kampungconnect -c "SELECT 1;"

# Test RabbitMQ connectivity
kubectl exec -it deployment/rabbitmq -n kampungconnect -- \
    rabbitmqctl status
```

### Monitoring & Debugging

- **Prometheus Metrics**: http://localhost:9090 - Check service metrics
- **Grafana Dashboards**: http://localhost:3000 - Visualize performance
- **RabbitMQ Management**: http://localhost:15672 - Monitor queues
- **Tempo Traces**: http://localhost:3200 - Distributed tracing
- **Pod Logs**: `kubectl logs -f <pod-name> -n kampungconnect`

## 🚀 Deployment

### Quick Deployment Scripts

| Script                  | Description                                    |
| ----------------------- | ---------------------------------------------- |
| `deploy-all.bat`      | Complete workflow: build + deploy              |
| `build-all.bat`       | Build all Docker images                        |
| `deploy-to-kuber.bat` | Deploy to Kubernetes                           |
| `port-forward.ps1`    | Start port forwards (Batch - separate windows) |

### Step-by-Step Deployment

**1. Build Docker Images**

```bash
build-all.bat
```

**2. Deploy to Kubernetes**

```bash
# Create namespace and deploy everything
deploy-to-kuber.bat

# Or manually:
kubectl apply -f k8s/base/namespace.yaml
kubectl create secret generic auth-secrets --from-env-file=.env -n kampungconnect
kubectl create configmap db-init-script --from-file=init.sql=backend/db/init.sql -n kampungconnect
kubectl apply -f k8s/infra/
kubectl apply -f k8s/services/
```

**3. Verify Deployment**

```bash
# Watch pods come up
kubectl get pods -n kampungconnect -w

# Check all services
kubectl get svc -n kampungconnect

# View deployment status
kubectl get deployments -n kampungconnect
```

**4. Start Port Forwarding**

```powershell
# PowerShell (recommended - background)
.\port-forward.ps1

# Or Batch (opens 12 windows)
port-forward.ps1
```

### Production Deployment Considerations

1. **Environment Variables**:

   - Use Kubernetes Secrets for sensitive data
   - Never commit `.env` files to version control
   - Use strong, unique JWT secrets (256+ bits)
   - Configure production OIDC redirect URIs (HTTPS)
   - Set appropriate SMTP credentials for email notifications
2. **Database**:

   - Use managed PostgreSQL (AWS RDS, Google Cloud SQL, Azure Database)
   - Enable automated backups and point-in-time recovery
   - Configure read replicas for high availability
   - Enable SSL/TLS for database connections
   - Set up proper database connection pooling
3. **Kubernetes Production**:

   ```bash
   # Use production namespaces
   kubectl create namespace kampungconnect-prod

   # Configure resource limits and requests
   # Edit k8s/services/*.yaml to add:
   resources:
     requests:
       memory: "256Mi"
       cpu: "250m"
     limits:
       memory: "512Mi"
       cpu: "500m"

   # Enable Horizontal Pod Autoscaling
   kubectl autoscale deployment auth-service \
     --cpu-percent=70 --min=2 --max=10 \
     -n kampungconnect-prod

   # Use Ingress for external access (instead of port-forward)
   kubectl apply -f k8s/production/ingress.yaml
   ```
4. **Security Hardening**:

   - Enable HTTPS with valid SSL certificates (Let's Encrypt, cert-manager)
   - Use Ingress Controller with TLS termination
   - Implement network policies for pod-to-pod communication
   - Enable RBAC (Role-Based Access Control)
   - Regular security scanning of container images
   - Set up Pod Security Policies/Standards
   - Use secrets management (HashiCorp Vault, AWS Secrets Manager)
5. **Observability**:

   - Configure Prometheus for long-term metrics storage
   - Set up Grafana alerting rules
   - Use persistent volumes for Grafana dashboards
   - Configure log aggregation (ELK, Loki)
   - Set up distributed tracing retention policies
   - Configure alerting (PagerDuty, Slack, email)
6. **High Availability**:

   - Deploy across multiple availability zones
   - Use LoadBalancer service type for external access
   - Configure pod anti-affinity rules
   - Set appropriate replica counts (min 2-3 per service)
   - Use RabbitMQ clustering for message queue HA
   - Configure database failover and replication
7. **CI/CD Pipeline**:

   ```yaml
   # Example GitHub Actions workflow
   - Build Docker images with version tags
   - Push to container registry (Docker Hub, ECR, GCR)
   - Run automated tests
   - Update Kubernetes manifests
   - Deploy with rolling updates
   - Run smoke tests
   - Rollback on failure
   ```

## 🔧 Troubleshooting

### Common Issues

| Issue                                                                      | Solution                                                                                                  |
| -------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| **"OIDC provider not configured"**                                   | Check `.env` file and provider credentials                                                              |
| **"Authentication failed"**                                          | Verify redirect URIs in provider settings                                                                 |
| **"Token validation failed"**                                        | Ensure JWT_SECRET is consistent in .env and Kubernetes secret                                             |
| **"CORS errors"**                                                    | Check FRONTEND_URL configuration                                                                          |
| **Infinite redirect loop**                                           | Clear browser cookies and localStorage                                                                    |
| **Pods in CrashLoopBackOff**                                         | Check logs:`kubectl logs <pod-name> -n kampungconnect`                                                  |
| **Port forward connection refused**                                  | Ensure pods are running:`kubectl get pods -n kampungconnect`                                            |
| **Database connection failed**                                       | Verify PostgreSQL pod is running and secrets are correct                                                  |
| **RabbitMQ connection timeout**                                      | Check RabbitMQ pod status and credentials                                                                 |
| **Image pull errors**                                                | Verify Docker images are built:`docker images \| grep kampungconnect`                                    |
| **Running scripts disabled on this system (on PowerShell terminal)** | Run `powershell -Command "Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser -Force"` |

### Kubernetes Debugging

```bash
# Check pod status
kubectl get pods -n kampungconnect

# View pod logs
kubectl logs -f <pod-name> -n kampungconnect

# View recent events
kubectl get events -n kampungconnect --sort-by='.lastTimestamp'

# Describe pod for detailed info
kubectl describe pod <pod-name> -n kampungconnect

# Check if services have endpoints
kubectl get endpoints -n kampungconnect

# Verify secrets exist
kubectl get secrets -n kampungconnect

# Verify configmaps exist
kubectl get configmaps -n kampungconnect

# Execute commands in pod
kubectl exec -it <pod-name> -n kampungconnect -- /bin/sh

# Test database connection from a pod
kubectl exec -it deployment/auth-service -n kampungconnect -- \
    psql -h postgres -U admin -d kampungconnect

# Restart a deployment
kubectl rollout restart deployment/<service-name> -n kampungconnect

# Check resource usage
kubectl top pods -n kampungconnect
kubectl top nodes
```

### Service-Specific Issues

**Auth Service:**

```bash
# Check if database is accessible
kubectl logs deployment/auth-service -n kampungconnect | grep -i "database\|connection"

# Verify OIDC configuration
kubectl logs deployment/auth-service -n kampungconnect | grep -i "oidc\|oauth"

# Test JWT generation
kubectl exec -it deployment/auth-service -n kampungconnect -- \
    node -e "console.log(process.env.JWT_SECRET)"
```

**Matching Service:**

```bash
# Check RabbitMQ connection
kubectl logs deployment/matching-service -n kampungconnect | grep -i "rabbitmq\|amqp"

# Verify matching algorithm
kubectl logs deployment/matching-service -n kampungconnect | grep -i "match\|postal"
```

**Notification Service:**

```bash
# Check SMTP configuration
kubectl logs deployment/notification-service -n kampungconnect | grep -i "smtp\|email"

# Verify email sending
kubectl logs deployment/notification-service -n kampungconnect --tail=50
```

### Port Forward Issues

#### Check if ports are already in use

```
netstat -ano | findstr "8080\|5001\|5002"
```

**Restart port forwards**

```
.\port-forward.ps1
```

#### Check PowerShell jobs

```
Get-Job
Get-Job | Receive-Job
```

# View output

```

### Database Issues

```bash
# Connect to database pod
kubectl exec -it deployment/postgres -n kampungconnect -- psql -U admin -d kampungconnect

# Check database tables
kubectl exec -it deployment/postgres -n kampungconnect -- \
    psql -U admin -d kampungconnect -c "\dt"

# Verify init script ran
kubectl logs deployment/postgres -n kampungconnect | grep -i "init\|schema"

# Recreate database (WARNING: deletes all data)
kubectl delete pod -l app=postgres -n kampungconnect
```

### Complete Reset

```bash
# Nuclear option - delete everything and start fresh
kubectl delete namespace kampungconnect

# Wait for namespace to be fully deleted
kubectl get namespace kampungconnect

# Redeploy
deploy-all.bat
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature-name`
3. Make your changes and test thoroughly
4. Build and test in Kubernetes: `build-all.bat && kubectl rollout restart deployment -n kampungconnect`
5. Commit: `git commit -m "Add feature: description"`
6. Push: `git push origin feature-name`
7. Create a Pull Request with detailed description

### Development Guidelines

- **Code Quality**: Follow RESTful API conventions and consistent code style
- **Error Handling**: Add comprehensive error handling and logging
- **Testing**: Test all services in Kubernetes environment
- **Authentication**: Verify OIDC integration works with all providers
- **Documentation**: Update README and relevant guides
- **Database Changes**: Update schema in `backend/db/init.sql`
- **Security**: Follow security best practices for authentication and data handling
- **Observability**: Add appropriate metrics, logs, and traces

### Before Submitting

```bash
# Build all images
build-all.bat

# Deploy to test environment
kubectl create namespace kampungconnect-test
# Update namespace in commands below
deploy-to-kuber.bat

# Verify all services are working
kubectl get pods -n kampungconnect
kubectl logs deployment/<service-name> -n kampungconnect

# Test endpoints
curl http://localhost:5001/
curl http://localhost:5002/

# Check metrics and traces
# Visit http://localhost:9090 (Prometheus)
# Visit http://localhost:3000 (Grafana)

# Clean up test environment
kubectl delete namespace kampungconnect-test
```

## 📚 Additional Resources

### External Documentation

- [OpenID Connect Specification](https://openid.net/connect/) - OIDC standards and best practices
- [Kubernetes Documentation](https://kubernetes.io/docs/) - Container orchestration
- [Docker Documentation](https://docs.docker.com/) - Containerization
- [Express.js Guide](https://expressjs.com/) - Backend framework documentation
- [PostgreSQL Documentation](https://www.postgresql.org/docs/) - Database management
- [RabbitMQ Tutorials](https://www.rabbitmq.com/getstarted.html) - Message queue patterns
- [Prometheus Documentation](https://prometheus.io/docs/) - Monitoring and alerting
- [Grafana Documentation](https://grafana.com/docs/) - Visualization and dashboards
- [OpenTelemetry Documentation](https://opentelemetry.io/docs/) - Observability and tracing

### Development Tools

- [kubectl](https://kubernetes.io/docs/reference/kubectl/) - Kubernetes CLI
- [k9s](https://k9scli.io/) - Terminal UI for Kubernetes
- [Lens](https://k8slens.dev/) - Kubernetes IDE
- [JWT.io](https://jwt.io/) - Token decoder and validator
- [OAuth 2.0 Playground](https://developers.google.com/oauthplayground) - Test OAuth flows
- [Postman](https://www.postman.com/) - API testing and documentation

### Monitoring & Observability

- **Prometheus**: http://localhost:9090 - Metrics and alerting
- **Grafana**: http://localhost:3000 - Dashboards and visualization
- **Tempo**: http://localhost:3200 - Distributed tracing
- **RabbitMQ Management**: http://localhost:15672 - Message queue monitoring

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 📞 Support

For issues and questions:

1. Check the troubleshooting section above
2. Review Kubernetes pod logs: `kubectl logs <pod-name> -n kampungconnect`
3. Check service health: `kubectl get pods -n kampungconnect`
4. Verify OIDC provider configuration
5. Review monitoring dashboards (Prometheus, Grafana)
6. Create an issue on GitHub with:
   - Pod logs
   - Steps to reproduce
   - Expected vs actual behavior
   - Environment details (Kubernetes version, OS, etc.)

---

**KampungConnect** - Building stronger communities through technology 🏘️❤️
