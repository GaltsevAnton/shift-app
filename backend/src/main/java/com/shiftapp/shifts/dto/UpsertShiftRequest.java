package com.shiftapp.shifts.dto;

import com.shiftapp.shifts.ShiftStatus;
import jakarta.validation.constraints.NotNull;

import java.time.LocalDate;
import java.time.LocalTime;

public class UpsertShiftRequest {

    @NotNull
    private Long userId;

    @NotNull
    private LocalDate workDate;

    @NotNull
    private LocalTime startTime;

    @NotNull
    private LocalTime endTime;

    private Integer breakMinutes; // optional
    private ShiftStatus status;   // optional (default PLANNED)

    private String note; // optional (на будущее)

    public Long getUserId() { return userId; }
    public void setUserId(Long userId) { this.userId = userId; }
    public LocalDate getWorkDate() { return workDate; }
    public void setWorkDate(LocalDate workDate) { this.workDate = workDate; }
    public LocalTime getStartTime() { return startTime; }
    public void setStartTime(LocalTime startTime) { this.startTime = startTime; }
    public LocalTime getEndTime() { return endTime; }
    public void setEndTime(LocalTime endTime) { this.endTime = endTime; }
    public Integer getBreakMinutes() { return breakMinutes; }
    public void setBreakMinutes(Integer breakMinutes) { this.breakMinutes = breakMinutes; }
    public ShiftStatus getStatus() { return status; }
    public void setStatus(ShiftStatus status) { this.status = status; }
    public String getNote() { return note; }
    public void setNote(String note) { this.note = note; }
}
