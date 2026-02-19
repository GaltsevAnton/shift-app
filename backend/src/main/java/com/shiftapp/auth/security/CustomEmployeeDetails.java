package com.shiftapp.auth.security;

import com.shiftapp.employees.Employee;
import com.shiftapp.employees.EmployeeRole;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;

import java.util.Collection;
import java.util.List;

public class CustomEmployeeDetails implements UserDetails {

    private final Employee employee;

    public CustomEmployeeDetails(Employee employee) {
        this.employee = employee;
    }

    public Long getEmployeeId() {
        return employee.getId();
    }

    public Long getRestaurantId() {
        return employee.getRestaurant().getId();
    }

    public EmployeeRole getRole() {
        return employee.getRole();
    }

    @Override
    public Collection<? extends GrantedAuthority> getAuthorities() {
        // Важно: ROLE_ + enumName
        return List.of(new SimpleGrantedAuthority("ROLE_" + employee.getRole().name()));
    }

    @Override
    public String getPassword() {
        return employee.getPasswordHash();
    }

    @Override
    public String getUsername() {
        return employee.getLogin();
    }

    @Override
    public boolean isAccountNonExpired() { return true; }

    @Override
    public boolean isAccountNonLocked() { return employee.isActive(); }

    @Override
    public boolean isCredentialsNonExpired() { return true; }

    @Override
    public boolean isEnabled() { return employee.isActive(); }
}
