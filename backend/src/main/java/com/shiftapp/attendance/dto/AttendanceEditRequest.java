package com.shiftapp.attendance.dto;

import java.time.Instant;

public class AttendanceEditRequest {

    private Instant recordedAt; // новое время
    private String  note;       // комментарий менеджера
    private String  recordType; // новый тип записи (CLOCK_IN/CLOCK_OUT/BREAK_START/BREAK_END), null = не менять

    public Instant getRecordedAt() { return recordedAt; }
    public void setRecordedAt(Instant recordedAt) { this.recordedAt = recordedAt; }

    public String getNote() { return note; }
    public void setNote(String note) { this.note = note; }

    public String getRecordType() { return recordType; }
    public void setRecordType(String recordType) { this.recordType = recordType; }
}