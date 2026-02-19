package com.shiftapp.employees.dto;

import com.shiftapp.employees.EmployeeRole;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public class EmployeeUpdateRequest {
    @NotBlank
    @Size(max = 100)
    public String login;

    @NotBlank
    @Size(max = 200)
    public String fullName;

    @NotNull
    public EmployeeRole role;

    public boolean active;

    // пароль НЕ обязателен: если пусто/ null — не меняем
    public String password;
}
