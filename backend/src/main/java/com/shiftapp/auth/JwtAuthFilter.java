//JwtAuthFilter максимально просто: 
// это “пограничник”, который перед каждым запросом пытается понять кто ты, глядя на JWT в заголовке.

package com.shiftapp.auth;

import com.shiftapp.auth.security.CustomEmployeeDetailsService;
import com.shiftapp.auth.security.CustomUserDetailsService;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;

@Component
//Spring сам создаст объект JwtAuthFilter и сможет вставить его в SecurityConfig.
public class JwtAuthFilter extends OncePerRequestFilter {
    //Filter = код, который выполняется до контроллера.
    // OncePerRequestFilter = Spring гарантирует, что этот фильтр выполнится один раз на один запрос.

    private final JwtService jwtService;    //jwtService — умеет “читать токен” (например получить username)
    private final CustomUserDetailsService userDetailsService;  //userDetailsService — умеет по username загрузить пользователя (как CustomUserDetails)
    private final CustomEmployeeDetailsService employeeDetailsService;

    public JwtAuthFilter(JwtService jwtService, 
                        CustomUserDetailsService userDetailsService, 
                        CustomEmployeeDetailsService employeeDetailsService) {
        this.jwtService = jwtService;
        this.userDetailsService = userDetailsService;
        this.employeeDetailsService = employeeDetailsService;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, 
                                    HttpServletResponse response, 
                                    FilterChain filterChain)
                                    /* Если бы ты не дал имена, код бы вообще не скомпилировался — в Java параметр обязан иметь имя.
                                    * Важно: это не “сокращение чтобы не писать тип”. 
                                    * Тип ты всё равно пишешь один раз в объявлении метода, а дальше используешь имя переменной.*/
            throws ServletException, IOException {

        String auth = request.getHeader("Authorization");
        if (auth == null || !auth.startsWith("Bearer ")) {
            filterChain.doFilter(request, response);
            return;
        }

        String token = auth.substring(7).trim();
        try {
            String username = jwtService.extractUsername(token);
            String typ = jwtService.extractType(token); // "USR" или "EMP"

            // если уже есть аутентификация — не трогаем
            if (username != null && SecurityContextHolder.getContext().getAuthentication() == null) {
                var userDetails = "EMP".equalsIgnoreCase(typ)
                        ? employeeDetailsService.loadUserByUsername(username)
                        : userDetailsService.loadUserByUsername(username);

                var authentication = new UsernamePasswordAuthenticationToken(
                        userDetails,
                        null,
                        userDetails.getAuthorities()
                );
                authentication.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));
                SecurityContextHolder.getContext().setAuthentication(authentication);
            }

            filterChain.doFilter(request, response);

        } catch (Exception ex) {
            response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);                // токен плохой/просрочен → просто 401
        }
    }
}
