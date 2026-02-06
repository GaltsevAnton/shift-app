package com.shiftapp.preferences.dto;

import com.shiftapp.preferences.PreferenceStatus;

import java.time.LocalDate;
import java.time.LocalTime;

public class PreferenceResponse {
    private Long id;
    private Long userId;
    private String userName;

    private LocalDate workDate;
    private LocalTime startTime;
    private LocalTime endTime;

    private PreferenceStatus status;
    private String comment;

    public PreferenceResponse() {}

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Long getUserId() { return userId; }
    public void setUserId(Long userId) { this.userId = userId; }
    public String getUserName() { return userName; }
    public void setUserName(String userName) { this.userName = userName; }
    public LocalDate getWorkDate() { return workDate; }
    public void setWorkDate(LocalDate workDate) { this.workDate = workDate; }
    public LocalTime getStartTime() { return startTime; }
    public void setStartTime(LocalTime startTime) { this.startTime = startTime; }
    public LocalTime getEndTime() { return endTime; }
    public void setEndTime(LocalTime endTime) { this.endTime = endTime; }
    public PreferenceStatus getStatus() { return status; }
    public void setStatus(PreferenceStatus status) { this.status = status; }
    public String getComment() { return comment; }
    public void setComment(String comment) { this.comment = comment; }
}
