package com.shiftapp.weeks.dto;

import jakarta.validation.constraints.NotNull;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;

public class StaffWeekSaveRequest {

    @NotNull
    private LocalDate weekStart;

    @NotNull
    private List<DayInput> days;

    public LocalDate getWeekStart() { return weekStart; }
    public void setWeekStart(LocalDate weekStart) { this.weekStart = weekStart; }
    public List<DayInput> getDays() { return days; }
    public void setDays(List<DayInput> days) { this.days = days; }

    public static class DayInput {
        @NotNull
        private LocalDate date;
        private boolean off;
        private LocalTime startTime;
        private LocalTime endTime;

        public LocalDate getDate() { return date; }
        public void setDate(LocalDate date) { this.date = date; }
        public boolean isOff() { return off; }
        public void setOff(boolean off) { this.off = off; }
        public LocalTime getStartTime() { return startTime; }
        public void setStartTime(LocalTime startTime) { this.startTime = startTime; }
        public LocalTime getEndTime() { return endTime; }
        public void setEndTime(LocalTime endTime) { this.endTime = endTime; }
    }
}
