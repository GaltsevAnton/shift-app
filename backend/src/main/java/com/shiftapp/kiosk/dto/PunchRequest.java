package com.shiftapp.kiosk.dto;

public class PunchRequest {

    private Long userId;
    private String recordType; // CLOCK_IN / CLOCK_OUT / BREAK_START / BREAK_END
    private String photoBase64; // base64 фото (nullable)

    public Long getUserId() { return userId; }
    public void setUserId(Long userId) { this.userId = userId; }

    public String getRecordType() { return recordType; }
    public void setRecordType(String recordType) { this.recordType = recordType; }

    public String getPhotoBase64() { return photoBase64; }
    public void setPhotoBase64(String photoBase64) { this.photoBase64 = photoBase64; }
}