package com.shiftapp.common;

import com.shiftapp.auth.security.CustomEmployeeDetails;
import com.shiftapp.auth.security.CustomUserDetails;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;

public final class CurrentUser {
    private CurrentUser() {}

    /** Для manager / IT: гарантирует, что это User */
    public static CustomUserDetails requireUser() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !(auth.getPrincipal() instanceof CustomUserDetails cud)) {
            throw new RuntimeException("Unauthorized (User required)");
        }
        return cud;
    }

    /** Для staff: гарантирует, что это Employee */
    public static CustomEmployeeDetails requireEmployee() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !(auth.getPrincipal() instanceof CustomEmployeeDetails ced)) {
            throw new RuntimeException("Unauthorized (Employee required)");
        }
        return ced;
    }

    /** Если нужно принимать и User и Employee (редко, но полезно) */
    public static Object requireAny() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || auth.getPrincipal() == null) {
            throw new RuntimeException("Unauthorized");
        }
        return auth.getPrincipal();
    }
}
