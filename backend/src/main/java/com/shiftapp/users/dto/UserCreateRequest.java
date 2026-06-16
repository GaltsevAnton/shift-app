package com.shiftapp.users.dto;

import com.shiftapp.users.UserRole;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.util.List;

public class UserCreateRequest {
    @NotBlank public String login;
    @NotBlank public String fullName;
    public String fullNameKana;
    public String position;
    public List<Long> departmentIds; // список id отделов
    @NotNull  public UserRole role;
    @NotBlank public String password;
}