package com.shiftapp.users.dto;

import com.shiftapp.users.User;
import com.shiftapp.users.UserRole;

import java.time.Instant;

public class UserResponse {

    public Long id;
    public String login;
    public String fullName;
    public UserRole role;
    public boolean active;
    public Instant createdAt;

    public static UserResponse from(User u) {
        UserResponse r = new UserResponse();
        r.id = u.getId();
        r.login = u.getLogin();
        r.fullName = u.getFullName();
        r.role = u.getRole();
        r.active = u.isActive();
        r.createdAt = u.getCreatedAt();
        return r;
    }
}