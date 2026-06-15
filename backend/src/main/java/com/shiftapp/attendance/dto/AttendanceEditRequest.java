package com.shiftapp.attendance.dto;

import java.time.Instant;

public class AttendanceEditRequest {

    private Instant recordedAt; // новое время
    private String  note;       // комментарий менеджера

    public Instant getRecordedAt() { return recordedAt; }
    public void setRecordedAt(Instant recordedAt) { this.recordedAt = recordedAt; }

    public String getNote() { return note; }
    public void setNote(String note) { this.note = note; }
}