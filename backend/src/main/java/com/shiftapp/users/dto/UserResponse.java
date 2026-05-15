package com.shiftapp.users.dto;

import com.shiftapp.users.User;
import com.shiftapp.users.UserRole;

public class UserResponse {
    public Long id;
    public String login;
    public String fullName;
    public String position;
    public String department;
    public UserRole role;
    public boolean active;

    public static UserResponse from(User u) {
        var r = new UserResponse();
        r.id         = u.getId();
        r.login      = u.getLogin();
        r.fullName   = u.getFullName();
        r.position   = u.getPosition();
        r.department = u.getDepartment();
        r.role       = u.getRole();
        r.active     = u.isActive();
        return r;
    }
}