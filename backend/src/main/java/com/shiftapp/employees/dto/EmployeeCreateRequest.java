package com.shiftapp.employees.dto;

import com.shiftapp.employees.EmployeeRole;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public class EmployeeCreateRequest {
    @NotBlank
    @Size(max = 100)
    public String login;

    @NotBlank
    @Size(max = 200)
    public String fullName;

    @NotNull
    public EmployeeRole role;

    @NotBlank
    @Size(min = 4, max = 100)
    public String password;
}
