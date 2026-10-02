package com.shiftapp.auth;

import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * Права текущего пользователя — для фронта (заглушки страниц / скрытие табов).
 * Путь под /api/manager/** — доступ уже ограничен MANAGER/ADMIN в SecurityConfig.
 * Права читаются из текущего Authentication (из БД при каждом запросе),
 * поэтому изменения роли применяются без релогина.
 */
@RestController
@RequestMapping("/api/manager/me")
public class MeController {

    @GetMapping("/permissions")
    public List<String> permissions(Authentication auth) {
        return auth.getAuthorities().stream()
                .map(GrantedAuthority::getAuthority)
                .filter(a -> !a.startsWith("ROLE_"))
                .sorted()
                .toList();
    }
}