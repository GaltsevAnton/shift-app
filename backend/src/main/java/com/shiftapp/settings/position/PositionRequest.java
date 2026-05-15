package com.shiftapp.settings.position;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public class PositionRequest {
    @NotBlank
    @Size(max = 100)
    public String name;
}