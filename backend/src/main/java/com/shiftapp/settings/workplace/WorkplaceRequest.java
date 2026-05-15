package com.shiftapp.settings.workplace;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public class WorkplaceRequest {
    @NotBlank
    @Size(max = 100)
    public String name;
}