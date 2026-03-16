# Build stage
FROM node:22-alpine AS builder

WORKDIR /app

# Install dependencies first (better caching)
COPY package.json package-lock.json* ./
RUN npm install --ignore-scripts

# Copy source and run postinstall + build
COPY . .
RUN npm run postinstall && npm run build

# Production stage - serve with nginx
FROM nginx:alpine AS production

# Copy built assets
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]

# Development stage
FROM node:22-alpine AS development

WORKDIR /app

# Copy everything and install
COPY . .
RUN npm install

EXPOSE 5173

CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
