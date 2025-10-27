# syntax=docker/dockerfile:1.4

ARG NODE_VERSION=18-alpine
FROM node:${NODE_VERSION} AS base
WORKDIR /app
ENV YARN_CACHE_FOLDER=/tmp/.yarn-cache
RUN apk add --no-cache python3 make g++

# --- Dependencies ---
FROM base AS deps
WORKDIR /app
# Bu satırları düzeltelim:
COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile --ignore-engines

# --- Development Stage ---
FROM deps AS development
WORKDIR /app
COPY . .
CMD ["yarn", "start:dev"]

# --- Build Stage ---
FROM deps AS build
WORKDIR /app
COPY . .
RUN yarn build

# --- Production Stage ---
FROM base AS production
WORKDIR /app
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
EXPOSE 4000
CMD ["node", "dist/src/main"]