package com.shiftapp.attendance.note;

import com.shiftapp.common.CurrentUser;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;

@RestController
@RequestMapping("/api/manager/attendance-notes")
public class AttendanceDayNoteController {

    private final AttendanceDayNoteService service;

    public AttendanceDayNoteController(AttendanceDayNoteService service) {
        this.service = service;
    }

    @GetMapping
    @PreAuthorize("hasAuthority('ATTENDANCE_VIEW')")
    public List<AttendanceDayNoteResponse> list(
        @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
        @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to
    ) {
        return service.list(CurrentUser.require().getRestaurantId(), from, to);
    }

    // body: {userId, workDate, statusId}; statusId = null — снять пометку
    @PutMapping
    @PreAuthorize("hasAuthority('ATTENDANCE_EDIT')")
    public AttendanceDayNoteResponse set(@RequestBody AttendanceDayNoteRequest req) {
        var me = CurrentUser.require();
        return service.set(me.getRestaurantId(), me.getUserId(), req);
    }
}