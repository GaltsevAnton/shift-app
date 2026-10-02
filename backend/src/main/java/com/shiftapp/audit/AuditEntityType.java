package com.shiftapp.audit;

// SHIFT/MONTH_STATUS — используются сейчас. Остальные зарезервированы для следующих
// этапов (従業員管理・設定), чтобы не менять enum каждый раз при расширении охвата.
public enum AuditEntityType {
    SHIFT,
    MONTH_STATUS,
    EMPLOYEE,
    DEPARTMENT,
    WORKPLACE,
    POSITION,
    BREAK_RULE
}