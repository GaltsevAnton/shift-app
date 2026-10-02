package com.shiftapp.attendance.note;

import java.time.LocalDate;

public record AttendanceDayNoteResponse(Long userId, LocalDate workDate, Long statusId, String label) {
    public static AttendanceDayNoteResponse from(AttendanceDayNote n) {
        return new AttendanceDayNoteResponse(
                n.getUser().getId(),
                n.getWorkDate(),
                n.getStatus() != null ? n.getStatus().getId() : null,
                n.getLabel());
    }
}