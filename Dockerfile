# syntax=docker/dockerfile:1.7

# --- build stage ---
FROM maven:3.9-eclipse-temurin-21 AS build
WORKDIR /workspace
COPY pom.xml .
RUN --mount=type=cache,target=/root/.m2 mvn -B -q dependency:go-offline
COPY src ./src
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
