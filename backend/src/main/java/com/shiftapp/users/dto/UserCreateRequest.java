package com.shiftapp.users.dto;

import com.shiftapp.users.UserRole;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public class UserCreateRequest {

    @NotBlank
    @Size(max = 100)
    public String login;

    @NotBlank
    @Size(max = 200)
    public String fullName;

    @NotNull
    public UserRole role;

    @NotBlank
    @Size(min = 4, max = 100)
    public String password;
}