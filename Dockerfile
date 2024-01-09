# This Dockerfile leverages multi-stage builds so
# only necessary build artifacts and resources are
# included in the final image.


# 1. Create base image from official Node image.
#    https://hub.docker.com/_/node/
FROM node:20-alpine AS base
# Change working directory.
WORKDIR /digital-edition-frontend-ng


# 2. Create intermediate build image, starting from base image.
FROM base AS build
# notify docker that static browser content will be a volume, so it can be used by nginx
# the volume should automatically be populated with the correct files from the image on first docker compose up
VOLUME [ "/digital-edition-frontend-ng/dist/app/browser" ]
# Copy all files from the source folder to the
# workdir in the container filesystem.
COPY . .
# Install the Angular CLI globally.
RUN npm install -g @angular/cli@17
# Install app dependencies.
RUN npm install
# Run script that generates sitemap.txt.
RUN npm run generate-sitemap
# Build the Angular SSR app.
RUN npm run build:ssr


# 3. Create final image, starting from base image.
FROM base AS final
# Copy package.json and package-lock.json from the
# source folder to the workdir in the container filesystem.
COPY package.json package-lock.json ./
# Install production dependencies of the app only. This is
# necessary because proxy-server.js, which is outside the
# Angular build but runs the server, requires the 'express'
# module.
RUN npm install --omit=dev
# Copy the dist folder from the build image to the final,
# runtime image.
COPY --from=build /digital-edition-frontend-ng/dist /digital-edition-frontend-ng/dist
# Set NODE_ENV environment variable to production.
ENV NODE_ENV production
# Run app.
CMD ["node","dist/app/proxy-server.js"]
