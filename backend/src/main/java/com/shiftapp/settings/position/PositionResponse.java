package com.shiftapp.settings.position;

public class PositionResponse {
    public Long id;
    public String name;

    public static PositionResponse from(Position p) {
        var r = new PositionResponse();
        r.id   = p.getId();
        r.name = p.getName();
        return r;
    }
}