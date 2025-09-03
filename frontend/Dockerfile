# frontend/Dockerfile

# 1. Build stage
FROM node:20-alpine AS build

WORKDIR /app

ARG VITE_FASTAPI_URL
ENV VITE_FASTAPI_URL=${VITE_FASTAPI_URL}

COPY frontend/package*.json ./
RUN npm install
COPY frontend/ ./
RUN npm run build

# 2. Serve stage
FROM nginx:stable-alpine

# Copy built assets
COPY --from=build /app/dist /usr/share/nginx/html

# Remove default config and use a minimal one
RUN rm /etc/nginx/conf.d/default.conf
COPY nginx/default.conf /etc/nginx/conf.d/

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
