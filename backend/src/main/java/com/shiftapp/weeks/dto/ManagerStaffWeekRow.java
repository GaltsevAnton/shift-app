package com.shiftapp.weeks.dto;

import java.util.List;

public class ManagerStaffWeekRow {
    private Long userId;
    private String userName;
    private List<StaffWeekDay> days;

    public Long getUserId() { return userId; }
    public void setUserId(Long userId) { this.userId = userId; }

    public String getUserName() { return userName; }
    public void setUserName(String userName) { this.userName = userName; }

    public List<StaffWeekDay> getDays() { return days; }
    public void setDays(List<StaffWeekDay> days) { this.days = days; }
}
