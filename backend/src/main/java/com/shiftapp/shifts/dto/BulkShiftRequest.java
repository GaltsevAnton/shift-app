package com.shiftapp.shifts.dto;

import jakarta.validation.constraints.NotEmpty;
import java.util.List;

public class BulkShiftRequest {
    @NotEmpty
    private List<BulkShiftItem> shifts;

    public List<BulkShiftItem> getShifts() { return shifts; }
    public void setShifts(List<BulkShiftItem> shifts) { this.shifts = shifts; }
}
