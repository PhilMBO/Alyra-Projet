# Stage 1 : Installation des dependances
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# Stage 2 : Build de l'application
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Les variables NEXT_PUBLIC_* doivent etre presentes au BUILD (pas au run)
# car Next.js les inline dans le JavaScript genere
ARG NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID
ENV NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID=$NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID
RUN npm run build

# Stage 3 : Image de production minimale
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
# Copie uniquement les fichiers necessaires (pas node_modules complet)
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
EXPOSE 3000
CMD ["node", "server.js"]