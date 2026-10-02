package com.shiftapp.roles.dto;

import com.shiftapp.roles.Permission;
import jakarta.validation.constraints.NotBlank;

import java.util.Set;

public class RoleRequest {

    @NotBlank
    public String name;

    public Set<Permission> permissions;
}