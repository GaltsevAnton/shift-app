package com.shiftapp.weeks.dto;

import java.time.LocalDate;
import java.time.LocalTime;

public class StaffWeekDay {
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
