package com.shiftapp.attendance.note;

import java.time.LocalDate;

public class AttendanceDayNoteRequest {
    private Long userId;
    private LocalDate workDate;
    private Long statusId; // null = убрать пометку

    public Long getUserId() { return userId; }
    public void setUserId(Long userId) { this.userId = userId; }
    public LocalDate getWorkDate() { return workDate; }
    public void setWorkDate(LocalDate workDate) { this.workDate = workDate; }
    public Long getStatusId() { return statusId; }
    public void setStatusId(Long statusId) { this.statusId = statusId; }
}