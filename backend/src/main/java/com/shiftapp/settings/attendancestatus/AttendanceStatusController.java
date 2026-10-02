package com.shiftapp.settings.attendancestatus;

import com.shiftapp.common.CurrentUser;
import jakarta.validation.Valid;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/manager/settings/attendance-statuses")
public class AttendanceStatusController {

    private final AttendanceStatusService service;

    public AttendanceStatusController(AttendanceStatusService service) {
        this.service = service;
    }

    // Список нужен и в 勤怠管理 для выпадающего списка — поэтому достаточно ATTENDANCE_VIEW
    @GetMapping
    @PreAuthorize("hasAnyAuthority('ATTENDANCE_STATUS_VIEW','ATTENDANCE_VIEW')")
    public List<AttendanceStatusResponse> list() {
        return service.list(CurrentUser.require().getRestaurantId());
    }

    @PostMapping
    @PreAuthorize("hasAuthority('ATTENDANCE_STATUS_CREATE')")
    public AttendanceStatusResponse create(@RequestBody @Valid AttendanceStatusRequest req) {
        return service.create(CurrentUser.require().getRestaurantId(), req);
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAuthority('ATTENDANCE_STATUS_EDIT')")
    public AttendanceStatusResponse update(@PathVariable Long id, @RequestBody @Valid AttendanceStatusRequest req) {
        return service.update(CurrentUser.require().getRestaurantId(), id, req);
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAuthority('ATTENDANCE_STATUS_DELETE')")
    public void delete(@PathVariable Long id) {
        service.delete(CurrentUser.require().getRestaurantId(), id);
    }
}