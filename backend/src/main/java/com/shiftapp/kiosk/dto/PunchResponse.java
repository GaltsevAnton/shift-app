package com.shiftapp.kiosk.dto;

import java.time.Instant;

public class PunchResponse {

    private Long recordId;
    private String recordType;
    private Instant recordedAt;
    private String userName;
    private String photoPath;

    public PunchResponse() {}

    public PunchResponse(Long recordId, String recordType, Instant recordedAt,
                         String userName, String photoPath) {
        this.recordId   = recordId;
        this.recordType = recordType;
        this.recordedAt = recordedAt;
        this.userName   = userName;
        this.photoPath  = photoPath;
    }

    public Long getRecordId() { return recordId; }
    public String getRecordType() { return recordType; }
    public Instant getRecordedAt() { return recordedAt; }
    public String getUserName() { return userName; }
    public String getPhotoPath() { return photoPath; }
}