package com.shiftapp.months;

import java.util.List;

public class SaveMonthRequest {

    private String month;
    private List<DayInput> days;

    public String getMonth() { return month; }
    public void setMonth(String month) { this.month = month; }
    public List<DayInput> getDays() { return days; }
    public void setDays(List<DayInput> days) { this.days = days; }

    public static class DayInput {
        private String date;
        private boolean off;
        private String startTime;
        private String endTime;

        public String getDate() { return date; }
        public void setDate(String date) { this.date = date; }
        public boolean isOff() { return off; }
        public void setOff(boolean off) { this.off = off; }
        public String getStartTime() { return startTime; }
        public void setStartTime(String startTime) { this.startTime = startTime; }
        public String getEndTime() { return endTime; }
        public void setEndTime(String endTime) { this.endTime = endTime; }
    }
}