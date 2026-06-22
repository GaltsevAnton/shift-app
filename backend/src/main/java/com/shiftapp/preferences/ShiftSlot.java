package com.shiftapp.preferences;

import jakarta.persistence.*;
import java.time.LocalTime;

@Entity
@Table(name = "shift_slots")
public class ShiftSlot {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(optional = false, fetch = FetchType.LAZY)
    @JoinColumn(name = "preference_id", nullable = false)
    private Preference preference;

    @Column(name = "slot_order", nullable = false)
    private int slotOrder = 0;

    @Column(name = "start_time")
    private LocalTime startTime;

    @Column(name = "end_time")
    private LocalTime endTime;

    @Column(name = "is_last", nullable = false)
    private boolean last = false;

    @Column(name = "workplace", length = 100)
    private String workplace;

    @Column(name = "next_day", nullable = false)
    private boolean nextDay = false;

    public ShiftSlot() {}

    public Long getId() { return id; }

    public Preference getPreference() { return preference; }
    public void setPreference(Preference preference) { this.preference = preference; }

    public int getSlotOrder() { return slotOrder; }
    public void setSlotOrder(int slotOrder) { this.slotOrder = slotOrder; }

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
}