package com.shiftapp.settings.workplace;

public class WorkplaceResponse {
    public Long id;
    public String name;

    public static WorkplaceResponse from(Workplace w) {
        var r = new WorkplaceResponse();
        r.id   = w.getId();
        r.name = w.getName();
        return r;
    }
}