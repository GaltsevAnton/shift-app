package com.shiftapp.common;

import com.shiftapp.auth.JwtAuthFilter;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.util.List;

@Configuration  //Говорит Spring: “в этом классе настройки и бины”.
@EnableMethodSecurity
//Разрешает аннотации типа @PreAuthorize(...) (если ты будешь их использовать). 
// Не обязательно для твоих requestMatchers, но полезно.
public class SecurityConfig {

    @Bean
    //“Создай этот объект один раз при запуске и храни его внутри Spring.
    // Потом, если кому-то нужен такой объект — давай ему этот же самый.”
    CorsConfigurationSource corsConfigurationSource() {     //CORS — это правила и разрешения для браузера
        //CorsConfigurationSource - Это тип (интерфейс) из Spring
        //corsConfigurationSource() - это имя метода, его ты выбираешь сам

        //Это нужно, чтобы React (http://localhost:5173) мог делать запросы на backend.
        CorsConfiguration cfg = new CorsConfiguration();

        // Vite dev server
        cfg.setAllowedOrigins(List.of("http://localhost:5173"));

        cfg.setAllowedMethods(List.of("GET","POST","PUT","PATCH","DELETE","OPTIONS"));
        cfg.setAllowedHeaders(List.of("Authorization","Content-Type"));
        cfg.setExposedHeaders(List.of("Authorization"));
        cfg.setAllowCredentials(false);

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", cfg);
        return source;
    }
    

    @Bean
    SecurityFilterChain filterChain(HttpSecurity http, JwtAuthFilter jwtAuthFilter) throws Exception {
        return http
                .cors(cors -> cors.configurationSource(corsConfigurationSource()))
                .csrf(csrf -> csrf.disable())
                .authorizeHttpRequests(auth -> auth         
                //правила доступа
                        .requestMatchers(HttpMethod.OPTIONS, "/**").permitAll()

                        .requestMatchers("/api/health").permitAll()     
                        //Этот URL открыт для всех (для проверки, что сервер жив)

                        .requestMatchers("/api/auth/**").permitAll()    
                        //Это значит:
                        // /api/auth/login
                        // /api/auth/register
                        // /api/auth/anything
                        // всё разрешено без токена, иначе ты не сможешь залогиниться.

                        .requestMatchers("/api/manager/**").hasRole("MANAGER")
                        //Это значит:
                        // если URL начинается на /api/manager/
                        // то пользователь должен иметь роль MANAGER.

                        .requestMatchers("/api/staff/**").hasAnyRole("STAFF", "MANAGER")
                        //Это значит:
                        // если URL начинается на /api/staff/
                        // то роль может быть STAFF или MANAGER.

                        .anyRequest().authenticated()
                        // Это правило на случай “всё, что не подошло выше”.
                )
                .addFilterBefore(jwtAuthFilter, UsernamePasswordAuthenticationFilter.class)    
                //подключаем проверку JWT
                // значит “Перед проверкой доступа прогоняй запрос через JwtAuthFilter”.
                .build();
    }
}
