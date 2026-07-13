package com.shiftapp.weeks.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.time.LocalTime;

public class SlotDto {

    private LocalTime startTime;
    private LocalTime endTime;

    @JsonProperty("last")
    private boolean last;

    private String workplace;
    private boolean nextDay;
    private Integer breakOverrideMinutes;

    public SlotDto() {}

    public SlotDto(LocalTime startTime, LocalTime endTime, boolean last, String workplace, boolean nextDay, Integer breakOverrideMinutes) {
        this.startTime = startTime;
        this.endTime   = endTime;
        this.last      = last;
        this.workplace = workplace;
        this.nextDay   = nextDay;
        this.breakOverrideMinutes = breakOverrideMinutes;
    }

    public LocalTime getStartTime() { return startTime; }
    public void setStartTime(LocalTime startTime) { this.startTime = startTime; }

    public LocalTime getEndTime() { return endTime; }
    public void setEndTime(LocalTime endTime) { this.endTime = endTime; }

    @JsonProperty("last")
    public boolean isLast() { return last; }

    @JsonProperty("last")
    public void setLast(boolean last) { this.last = last; }

    public String getWorkplace() { return workplace; }
    public void setWorkplace(String workplace) { this.workplace = workplace; }

    public boolean isNextDay() { return nextDay; }
    public void setNextDay(boolean nextDay) { this.nextDay = nextDay; }

    public Integer getBreakOverrideMinutes() { return breakOverrideMinutes; }
}