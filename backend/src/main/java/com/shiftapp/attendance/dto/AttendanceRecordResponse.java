package com.shiftapp.attendance.dto;

import java.time.Instant;
import java.time.LocalDate;

public class AttendanceRecordResponse {

    private Long       id;
    private Long       userId;
    private String     userName;
    private LocalDate  workDate;
    private String     recordType;
    private Instant    recordedAt;
    private String     photoPath;
    private String     note;
    private boolean    edited;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Long getUserId() { return userId; }
    public void setUserId(Long userId) { this.userId = userId; }

    public String getUserName() { return userName; }
    public void setUserName(String userName) { this.userName = userName; }

    public LocalDate getWorkDate() { return workDate; }
    public void setWorkDate(LocalDate workDate) { this.workDate = workDate; }

    public String getRecordType() { return recordType; }
    public void setRecordType(String recordType) { this.recordType = recordType; }

    public Instant getRecordedAt() { return recordedAt; }
    public void setRecordedAt(Instant recordedAt) { this.recordedAt = recordedAt; }

    public String getPhotoPath() { return photoPath; }
    public void setPhotoPath(String photoPath) { this.photoPath = photoPath; }

    public String getNote() { return note; }
    public void setNote(String note) { this.note = note; }

    public boolean isEdited() { return edited; }
    public void setEdited(boolean edited) { this.edited = edited; }
}