package com.shiftapp.users.dto;

import com.shiftapp.users.UserRole;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public class UserUpdateRequest {

    @NotBlank
    @Size(max = 100)
    public String login;

    @NotBlank
    @Size(max = 200)
    public String fullName;

    @NotNull
    public UserRole role;

    public boolean active;

    // пароль не обязателен: если null или пусто — не меняем
    public String password;
}