package com.shiftapp.settings.breakrule;

public class BreakRuleResponse {
    public Long   id;
    public String name;
    public int    thresholdMinutes;
    public int    breakMinutes;

    public static BreakRuleResponse from(BreakRule r) {
        var res = new BreakRuleResponse();
        res.id               = r.getId();
        res.name             = r.getName();
        res.thresholdMinutes = r.getThresholdMinutes();
        res.breakMinutes     = r.getBreakMinutes();
        return res;
    }
}