package com.shiftapp.settings.attendancestatus;

public record AttendanceStatusResponse(Long id, String name) {
    public static AttendanceStatusResponse from(AttendanceStatus s) {
        return new AttendanceStatusResponse(s.getId(), s.getName());
    }
}