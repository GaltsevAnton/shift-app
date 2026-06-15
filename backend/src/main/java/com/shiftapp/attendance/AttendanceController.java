package com.shiftapp.attendance;

import com.shiftapp.attendance.dto.AttendanceEditRequest;
import com.shiftapp.attendance.dto.AttendanceRecordResponse;
import com.shiftapp.common.CurrentUser;
import com.shiftapp.kiosk.TimeRecord;
import com.shiftapp.kiosk.TimeRecordRepository;
import com.shiftapp.users.UserRepository;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

@RestController
@RequestMapping("/api/manager/attendance")
public class AttendanceController {

    private final TimeRecordRepository timeRecordRepository;
    private final UserRepository       userRepository;

    public AttendanceController(TimeRecordRepository timeRecordRepository,
                                UserRepository userRepository) {
        this.timeRecordRepository = timeRecordRepository;
        this.userRepository       = userRepository;
    }

    // Все записи ресторана за диапазон дат
    @GetMapping
    public List<AttendanceRecordResponse> getRecords(
        @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
        @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to
    ) {
        var me = CurrentUser.require();
        return timeRecordRepository
            .findByRestaurantAndDateRange(me.getRestaurantId(), from, to)
            .stream()
            .map(this::toResponse)
            .toList();
    }

    // Ручная правка записи менеджером
    @PutMapping("/{id}")
    public AttendanceRecordResponse editRecord(
        @PathVariable Long id,
        @RequestBody AttendanceEditRequest req
    ) {
        var me = CurrentUser.require();
        TimeRecord record = timeRecordRepository.findById(id)
            .orElseThrow(() -> new IllegalArgumentException("Record not found"));

        // Проверяем что запись принадлежит тому же ресторану
        if (!record.getRestaurant().getId().equals(me.getRestaurantId()))
            throw new IllegalArgumentException("Access denied");

        if (req.getRecordedAt() != null) record.setRecordedAt(req.getRecordedAt());
        if (req.getNote() != null)       record.setNote(req.getNote());

        var editor = userRepository.findById(me.getUserId()).orElseThrow();
        record.setEditedBy(editor);
        record.setEditedAt(Instant.now());

        return toResponse(timeRecordRepository.save(record));
    }

    private AttendanceRecordResponse toResponse(TimeRecord r) {
        AttendanceRecordResponse res = new AttendanceRecordResponse();
        res.setId(r.getId());
        res.setUserId(r.getUser().getId());
        res.setUserName(r.getUser().getFullName());
        res.setWorkDate(r.getWorkDate());
        res.setRecordType(r.getRecordType().name());
        res.setRecordedAt(r.getRecordedAt());
        res.setPhotoPath(r.getPhotoPath());
        res.setNote(r.getNote());
        res.setEdited(r.getEditedBy() != null);
        return res;
    }
}