package com.shiftapp.shifts.dto;

import java.time.LocalDate;

import jakarta.validation.constraints.NotNull;

public class CopyWeekRequest {

    @NotNull
    private LocalDate fromWeekStart;

    @NotNull
    private LocalDate toWeekStart;

    private boolean overwrite = false;

    public LocalDate getFromWeekStart() { return fromWeekStart; }
    public void setFromWeekStart(LocalDate fromWeekStart) { this.fromWeekStart = fromWeekStart; }

    public LocalDate getToWeekStart() { return toWeekStart; }
    public void setToWeekStart(LocalDate toWeekStart) { this.toWeekStart = toWeekStart; }

    public boolean isOverwrite() { return overwrite; }
    public void setOverwrite(boolean overwrite) { this.overwrite = overwrite; }
}
