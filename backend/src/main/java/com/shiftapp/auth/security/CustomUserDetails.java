package com.shiftapp.auth.security;

import com.shiftapp.roles.Permission;
import com.shiftapp.users.User;
import com.shiftapp.users.UserRole;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails; 

import java.util.ArrayList;
import java.util.Collection;
import java.util.List;

public class CustomUserDetails implements UserDetails {
    private final User user;

    public CustomUserDetails(User user) {
        this.user = user;
    }

    public Long getUserId() { return user.getId(); }
    public Long getRestaurantId() { return user.getRestaurant().getId(); }
    public UserRole getRole() { return user.getRole(); }
    public String getFullName() { return user.getFullName(); }

    @Override  //“Я переопределяю метод, который обязателен по интерфейсу UserDetails”.
    public Collection<? extends GrantedAuthority> getAuthorities() {
        // Базовая роль (ROLE_STAFF / ROLE_MANAGER / ROLE_ADMIN / ROLE_KIOSK) —
        // остаётся для грубых проверок по hasRole(...).
        List<GrantedAuthority> authorities = new ArrayList<>();
        authorities.add(new SimpleGrantedAuthority("ROLE_" + user.getRole().name()));

        // Плюс точечные права (Permission) — для hasAuthority(...):
        // ADMIN получает все существующие права,
        // остальные — только то, что назначено в их customRole (если она назначена).
        if (user.getRole() == UserRole.ADMIN) {
            for (Permission p : Permission.values()) {
                authorities.add(new SimpleGrantedAuthority(p.name()));
            }
        } else if (user.getCustomRole() != null) {
            for (Permission p : user.getCustomRole().getPermissions()) {
                authorities.add(new SimpleGrantedAuthority(p.name()));
            }
        }

        return authorities;
    }

    @Override
    public String getPassword() {return user.getPasswordHash();}

    @Override
    public String getUsername() {return user.getLogin();}

    @Override
    public boolean isAccountNonExpired() { return true; }

    @Override
    public boolean isAccountNonLocked() { return true; }

    @Override
    public boolean isCredentialsNonExpired() { return true; }

    @Override
    public boolean isEnabled() { return user.isActive(); }
}