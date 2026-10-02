package com.shiftapp.weeks.dto;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;

public class ManagerStaffDaySaveRequest {
    private LocalDate date;
    private boolean off;
    private List<SlotInput> slots;

    public LocalDate getDate() { return date; }
    public void setDate(LocalDate date) { this.date = date; }
    public boolean isOff() { return off; }
    public void setOff(boolean off) { this.off = off; }
    public List<SlotInput> getSlots() { return slots; }
    public void setSlots(List<SlotInput> slots) { this.slots = slots; }

    public static class SlotInput {
        private LocalTime startTime;
        private LocalTime endTime;
        private boolean last;
        private String workplace;
        private boolean nextDay;
        private Integer breakOverrideMinutes;

        public LocalTime getStartTime() { return startTime; }
        public void setStartTime(LocalTime startTime) { this.startTime = startTime; }
        public LocalTime getEndTime() { return endTime; }
        public void setEndTime(LocalTime endTime) { this.endTime = endTime; }
        public boolean isLast() { return last; }
        public void setLast(boolean last) { this.last = last; }
        public String getWorkplace() { return workplace; }
        public void setWorkplace(String workplace) { this.workplace = workplace; }
        public boolean isNextDay() { return nextDay; }
        public void setNextDay(boolean nextDay) { this.nextDay = nextDay; }
        public Integer getBreakOverrideMinutes() { return breakOverrideMinutes; }
        public void setBreakOverrideMinutes(Integer breakOverrideMinutes) { this.breakOverrideMinutes = breakOverrideMinutes; }
    }
}