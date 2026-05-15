package com.shiftapp.preferences.dto;

import com.shiftapp.preferences.PreferenceStatus;

import java.time.LocalDate;

public class PreferenceResponse {
    private Long id;
    private Long userId;
    private String userName;
    private LocalDate workDate;
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

    public PreferenceStatus getStatus() { return status; }
    public void setStatus(PreferenceStatus status) { this.status = status; }

    public String getComment() { return comment; }
    public void setComment(String comment) { this.comment = comment; }
}