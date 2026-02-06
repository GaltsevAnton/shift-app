package com.shiftapp.weeks.dto;

import com.shiftapp.weeks.WeekStatusType;

import java.time.LocalDate;

public class WeekRowResponse {
    private LocalDate weekStart;
    private LocalDate weekEnd;
    private WeekStatusType status;

    public LocalDate getWeekStart() { return weekStart; }
    public void setWeekStart(LocalDate weekStart) { this.weekStart = weekStart; }
    public LocalDate getWeekEnd() { return weekEnd; }
    public void setWeekEnd(LocalDate weekEnd) { this.weekEnd = weekEnd; }
    public WeekStatusType getStatus() { return status; }
    public void setStatus(WeekStatusType status) { this.status = status; }
}
