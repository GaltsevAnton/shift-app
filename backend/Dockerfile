# ── Этап 1: сборка ──
FROM maven:3.9-eclipse-temurin-21 AS build

WORKDIR /app

# Сначала копируем только pom.xml — Docker кэширует слой с зависимостями,
# и при изменении только кода Maven не будет заново скачивать все библиотеки
COPY pom.xml .
RUN mvn dependency:go-offline -B

# Теперь копируем исходники и собираем jar
COPY src ./src
RUN mvn clean package -DskipTests

# ── Этап 2: финальный лёгкий образ ──
FROM eclipse-temurin:21-jre

WORKDIR /app

# Забираем ТОЛЬКО готовый jar из первого этапа
COPY --from=build /app/target/backend-0.0.1-SNAPSHOT.jar app.jar

EXPOSE 8080

ENTRYPOINT ["java", "-jar", "app.jar"]