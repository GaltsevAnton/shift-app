package com.shiftapp.weeks.dto;

import com.shiftapp.weeks.WeekStatusType;

import java.util.List;

public class StaffWeekResponse {
    private WeekStatusType status;
    private List<StaffWeekDay> days;

    public WeekStatusType getStatus() { return status; }
    public void setStatus(WeekStatusType status) { this.status = status; }
    public List<StaffWeekDay> getDays() { return days; }
    public void setDays(List<StaffWeekDay> days) { this.days = days; }
}
