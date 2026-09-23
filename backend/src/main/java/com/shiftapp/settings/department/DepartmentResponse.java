package com.shiftapp.settings.department;

public class DepartmentResponse {
    public Long id;
    public String name;
    public int sortOrder;

    public static DepartmentResponse from(Department d) {
        var r = new DepartmentResponse();
        r.id   = d.getId();
        r.name = d.getName();
        r.sortOrder = d.getSortOrder();
        return r;
    }
}