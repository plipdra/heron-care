# syntax=docker/dockerfile:1.7

# Single multi-stage build that produces a fat jar containing both API and SPA.
# Used for the Render single-service deploy. Local docker-compose still builds
# backend and frontend separately so Vite hot reload works in dev.

# --- build stage ---
FROM maven:3.9-eclipse-temurin-21 AS build
WORKDIR /workspace

# Resolve maven deps first so source changes don't bust this layer.
COPY pom.xml .
RUN --mount=type=cache,target=/root/.m2 mvn -B -q dependency:go-offline

# Backend sources + full frontend folder. frontend-maven-plugin will install
# Node into target/, run npm ci, and run npm run build during the maven build.
COPY src ./src
COPY frontend ./frontend

RUN --mount=type=cache,target=/root/.m2 mvn -B -q -DskipTests package

# --- runtime stage ---
FROM eclipse-temurin:21-jre-alpine
RUN addgroup -S heron && adduser -S heron -G heron
WORKDIR /app
COPY --from=build /workspace/target/*.jar app.jar
RUN mkdir -p /app/uploads && chown -R heron:heron /app
USER heron
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "app.jar"]
