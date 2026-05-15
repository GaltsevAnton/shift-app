package com.shiftapp.users.dto;

import com.shiftapp.users.UserRole;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public class UserUpdateRequest {
    @NotBlank public String login;
    @NotBlank public String fullName;
    public String position;
    public String department;
    @NotNull  public UserRole role;
    public boolean active;
    public String password;
}