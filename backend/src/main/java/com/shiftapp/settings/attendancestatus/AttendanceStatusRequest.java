package com.shiftapp.settings.attendancestatus;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public class AttendanceStatusRequest {
    @NotBlank
    @Size(max = 100)
    public String name;
}