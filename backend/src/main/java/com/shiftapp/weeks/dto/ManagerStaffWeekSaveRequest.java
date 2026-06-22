package com.shiftapp.weeks.dto;

import jakarta.validation.constraints.NotNull;
import java.time.LocalDate;
import java.util.List;

public class ManagerStaffWeekSaveRequest {

    @NotNull
    private LocalDate weekStart;

    @NotNull
    private List<DayInput> days;

    public LocalDate getWeekStart() { return weekStart; }
    public void setWeekStart(LocalDate weekStart) { this.weekStart = weekStart; }

    public List<DayInput> getDays() { return days; }
    public void setDays(List<DayInput> days) { this.days = days; }

    public static class DayInput {
        @NotNull
        private LocalDate date;

        private boolean off;

        // slots: пусто или null = выходной (если off=false и пусто — тоже выходной)
        private List<SlotInput> slots;

        public LocalDate getDate() { return date; }
        public void setDate(LocalDate date) { this.date = date; }

        public boolean isOff() { return off; }
        public void setOff(boolean off) { this.off = off; }

        public List<SlotInput> getSlots() { return slots; }
        public void setSlots(List<SlotInput> slots) { this.slots = slots; }
    }

    public static class SlotInput {
        private java.time.LocalTime startTime;
        private java.time.LocalTime endTime;
        private boolean last;
        private String workplace;
        private boolean nextDay;

        public java.time.LocalTime getStartTime() { return startTime; }
        public void setStartTime(java.time.LocalTime startTime) { this.startTime = startTime; }

        public java.time.LocalTime getEndTime() { return endTime; }
        public void setEndTime(java.time.LocalTime endTime) { this.endTime = endTime; }

        public boolean isLast() { return last; }
        public void setLast(boolean last) { this.last = last; }

        public String getWorkplace() { return workplace; }
        public void setWorkplace(String workplace) { this.workplace = workplace; }

        public boolean isNextDay() { return nextDay; }
        public void setNextDay(boolean nextDay) { this.nextDay = nextDay; }
    }
}