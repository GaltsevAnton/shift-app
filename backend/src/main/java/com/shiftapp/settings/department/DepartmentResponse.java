package com.shiftapp.settings.department;

public class DepartmentResponse {
    public Long id;
    public String name;

    public static DepartmentResponse from(Department d) {
        var r = new DepartmentResponse();
        r.id   = d.getId();
        r.name = d.getName();
        return r;
    }
}