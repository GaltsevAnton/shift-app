package com.shiftapp.audit.dto;

import com.shiftapp.audit.AuditLog;

import java.time.Instant;

public class AuditLogResponse {
    public Long id;
    public Long actorUserId;
    public String actorName;
    public String action;
    public String entityType;
    public Long entityId;
    public Long targetUserId;
    public String targetUserName;
    public String summary;
    public String details;
    public Instant createdAt;

    public static AuditLogResponse from(AuditLog a) {
        var r = new AuditLogResponse();
        r.id             = a.getId();
        r.actorUserId    = a.getActorUser() != null ? a.getActorUser().getId() : null;
        r.actorName      = a.getActorName();
        r.action         = a.getAction().name();
        r.entityType     = a.getEntityType().name();
        r.entityId       = a.getEntityId();
        r.targetUserId   = a.getTargetUser() != null ? a.getTargetUser().getId() : null;
        r.targetUserName = a.getTargetUserName();
        r.summary        = a.getSummary();
        r.details        = a.getDetails();
        r.createdAt      = a.getCreatedAt();
        return r;
    }
}