package com.shiftapp.kiosk.dto;

import java.time.Instant;

public class StaffStatusResponse {

    // Текущий статус сотрудника за сегодня:
    // NOT_STARTED / WORKING / ON_BREAK / FINISHED
    private String status;
    private Instant clockInAt;
    private Instant clockOutAt;
    private Instant breakStartAt;
    private Instant breakEndAt;
    private String lastPhotoPath;

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public Instant getClockInAt() { return clockInAt; }
    public void setClockInAt(Instant clockInAt) { this.clockInAt = clockInAt; }

    public Instant getClockOutAt() { return clockOutAt; }
    public void setClockOutAt(Instant clockOutAt) { this.clockOutAt = clockOutAt; }

    public Instant getBreakStartAt() { return breakStartAt; }
    public void setBreakStartAt(Instant breakStartAt) { this.breakStartAt = breakStartAt; }

    public Instant getBreakEndAt() { return breakEndAt; }
    public void setBreakEndAt(Instant breakEndAt) { this.breakEndAt = breakEndAt; }

    public String getLastPhotoPath() { return lastPhotoPath; }
    public void setLastPhotoPath(String lastPhotoPath) { this.lastPhotoPath = lastPhotoPath; }
}