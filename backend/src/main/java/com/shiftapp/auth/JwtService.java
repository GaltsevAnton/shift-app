package com.shiftapp.auth;

import com.shiftapp.auth.security.CustomUserDetails;
// import com.shiftapp.auth.security.CustomEmployeeDetails;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Date;

@Service
public class JwtService {

    private final SecretKey key;    //— секретный ключ, которым подписывается токен (чтобы его нельзя было подделать)
    private final long accessTokenMinutes;  //— сколько минут живёт токен

    public JwtService(@Value("${app.jwt.secret}") String secret,        //@Value - Это команда Spring: “возьми значение из application.properties (или application.yml)
                      @Value("${app.jwt.access-token-minutes}") long accessTokenMinutes) {
        this.key = Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
        // берём строку secret
        // превращаем в байты UTF-8
        // делаем SecretKey для HMAC (обычно HS256)
        this.accessTokenMinutes = accessTokenMinutes;
    }

    public String generateAccessToken(CustomUserDetails user) {
        // передаёшь пользователя (в обёртке CustomUserDetails) — чтобы взять:
        //     username
        //     userId
        //     restaurantId
        //     role
        Instant now = Instant.now();    //now = текущее время
        Instant exp = now.plus(accessTokenMinutes, ChronoUnit.MINUTES);     //exp = now + N минут

        return Jwts.builder()
                .subject(user.getUsername())
                .issuedAt(Date.from(now))
                .expiration(Date.from(exp))
                .claim("uid", user.getUserId())
                .claim("rid", user.getRestaurantId())
                .claim("role", user.getRole().name())
                // .claim("typ", "USR")
                .signWith(key)
                .compact();
    }

    public String extractUsername(String token) {
        return Jwts.parser()
                .verifyWith(key)
                .build()
                .parseSignedClaims(token)
                .getPayload()
                .getSubject();
    }
}
