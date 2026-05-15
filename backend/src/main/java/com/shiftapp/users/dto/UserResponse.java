package com.shiftapp.users.dto;

import com.shiftapp.users.User;
import com.shiftapp.users.UserRole;
import java.util.List;

public class UserResponse {
    public Long id;
    public String login;
    public String fullName;
    public String position;
    public List<DeptItem> departments;
    public UserRole role;
    public boolean active;

    public static class DeptItem {
        public Long id;
        public String name;
        public DeptItem(Long id, String name) { this.id = id; this.name = name; }
    }

    public static UserResponse from(User u) {
        var r = new UserResponse();
        r.id          = u.getId();
        r.login       = u.getLogin();
        r.fullName    = u.getFullName();
        r.position    = u.getPosition();
        r.role        = u.getRole();
        r.active      = u.isActive();
        r.departments = u.getDepartments().stream()
                .map(d -> new DeptItem(d.getId(), d.getName()))
                .sorted((a, b) -> a.name.compareTo(b.name))
                .toList();
        return r;
    }
}