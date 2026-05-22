FROM node:20-alpine AS build

WORKDIR /app

# Firebase env vars must be present at build time (Vite inlines them)
ARG VITE_FIREBASE_API_KEY
ARG VITE_FIREBASE_AUTH_DOMAIN
ARG VITE_FIREBASE_PROJECT_ID
ARG VITE_FIREBASE_STORAGE_BUCKET
ARG VITE_FIREBASE_MESSAGING_SENDER_ID
ARG VITE_FIREBASE_APP_ID
ENV VITE_FIREBASE_API_KEY=$VITE_FIREBASE_API_KEY
ENV VITE_FIREBASE_AUTH_DOMAIN=$VITE_FIREBASE_AUTH_DOMAIN
ENV VITE_FIREBASE_PROJECT_ID=$VITE_FIREBASE_PROJECT_ID
ENV VITE_FIREBASE_STORAGE_BUCKET=$VITE_FIREBASE_STORAGE_BUCKET
ENV VITE_FIREBASE_MESSAGING_SENDER_ID=$VITE_FIREBASE_MESSAGING_SENDER_ID
ENV VITE_FIREBASE_APP_ID=$VITE_FIREBASE_APP_ID

COPY package.json package-lock.json .npmrc ./
RUN npm ci --legacy-peer-deps

COPY . .
RUN npm run build

# --- Production stage ---
FROM node:20-alpine
WORKDIR /app
RUN npm install -g serve
COPY --from=build /app/dist ./dist

EXPOSE 3000
# Note: no -s flag. The SPA catch-all rewrite is configured in dist/serve.json
# (copied from public/serve.json at build) alongside the static-file rewrites
# for /design-system. `serve -s` REPLACES the rewrites array, which would
# overwrite our static-file routes.
CMD ["serve", "dist", "-l", "tcp://0.0.0.0:3000"]
