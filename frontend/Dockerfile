FROM nginx:alpine
WORKDIR /usr/share/nginx/html

# Copy nginx configuration for development (no caching)
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy application files
COPY . .