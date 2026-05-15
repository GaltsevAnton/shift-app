package com.shiftapp.settings.department;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public class DepartmentRequest {
    @NotBlank
    @Size(max = 100)
    public String name;
}