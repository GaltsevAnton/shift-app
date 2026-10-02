package com.shiftapp.roles.dto;

import com.shiftapp.roles.Permission;
import com.shiftapp.roles.Role;

import java.time.Instant;
import java.util.Set;

public class RoleResponse {

    public Long id;
    public String name;
    public Set<Permission> permissions;
    public Instant createdAt;

    public static RoleResponse from(Role role) {
        RoleResponse res = new RoleResponse();
        res.id = role.getId();
        res.name = role.getName();
        res.permissions = role.getPermissions();
        res.createdAt = role.getCreatedAt();
        return res;
    }
}