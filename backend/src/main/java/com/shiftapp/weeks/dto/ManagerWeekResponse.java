package com.shiftapp.weeks.dto;

import com.shiftapp.weeks.WeekStatusType;
import java.util.List;

public class ManagerWeekResponse {
    private WeekStatusType status;
    private List<ManagerStaffWeekRow> rows;

    public WeekStatusType getStatus() { return status; }
    public void setStatus(WeekStatusType status) { this.status = status; }

    public List<ManagerStaffWeekRow> getRows() { return rows; }
    public void setRows(List<ManagerStaffWeekRow> rows) { this.rows = rows; }
}
