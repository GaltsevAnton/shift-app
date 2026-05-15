package com.shiftapp.weeks.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;

public class StaffWeekDay {
    private LocalDate date;
    private boolean off;

    // Для сотрудника: самое раннее начало и самое позднее окончание
    private LocalTime startTime;
    private LocalTime endTime;

    @JsonProperty("last")
    private boolean last;

    // Для менеджера: полный список слотов
    private List<SlotDto> slots;

    public LocalDate getDate() { return date; }
    public void setDate(LocalDate date) { this.date = date; }

    public boolean isOff() { return off; }
    public void setOff(boolean off) { this.off = off; }

    public LocalTime getStartTime() { return startTime; }
    public void setStartTime(LocalTime startTime) { this.startTime = startTime; }

    public LocalTime getEndTime() { return endTime; }
    public void setEndTime(LocalTime endTime) { this.endTime = endTime; }

    @JsonProperty("last")
    public boolean isLast() { return last; }

    @JsonProperty("last")
    public void setLast(boolean last) { this.last = last; }

    public List<SlotDto> getSlots() { return slots; }
    public void setSlots(List<SlotDto> slots) { this.slots = slots; }
}