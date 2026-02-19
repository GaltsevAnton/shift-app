package com.shiftapp.employees.dto;

import com.shiftapp.employees.Employee;
import com.shiftapp.employees.EmployeeRole;

import java.time.Instant;

public class EmployeeResponse {
    public Long id;
    public String login;
    public String fullName;
    public EmployeeRole role;
    public boolean active;
    public Instant createdAt;

    public static EmployeeResponse from(Employee e) {
        EmployeeResponse r = new EmployeeResponse();
        r.id = e.getId();
        r.login = e.getLogin();
        r.fullName = e.getFullName();
        r.role = e.getRole();
        r.active = e.isActive();
        r.createdAt = e.getCreatedAt();
        return r;
    }
}
