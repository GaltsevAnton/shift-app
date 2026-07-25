package com.shiftapp.attendance;

import com.shiftapp.attendance.dto.AttendanceEditRequest;
import com.shiftapp.attendance.dto.AttendanceRecordResponse;
import com.shiftapp.common.CurrentUser;
import com.shiftapp.kiosk.TimeRecord;
import com.shiftapp.kiosk.TimeRecordRepository;
import com.shiftapp.kiosk.TimeRecordType;
import com.shiftapp.users.UserRepository;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.*;

import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
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
    @Transactional(readOnly = true)
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

    @Transactional
    @PutMapping("/{id}")
    public AttendanceRecordResponse editRecord(
        @PathVariable Long id,
        @RequestBody AttendanceEditRequest req
    ) {
        var me = CurrentUser.require();
        TimeRecord record = timeRecordRepository.findById(id)
            .orElseThrow(() -> new IllegalArgumentException("Record not found"));

        if (!record.getRestaurant().getId().equals(me.getRestaurantId()))
            throw new IllegalArgumentException("Access denied");

        if (req.getRecordedAt() != null) {
            if (record.getRecordType() == TimeRecordType.CLOCK_IN) {
                // CLOCK_IN определяет ячейку всей смены — двигаем всю сессию целиком
                List<TimeRecord> session = findSessionRecords(record);
                LocalDate newWorkDate = req.getRecordedAt()
                    .atZone(ZoneId.of("Asia/Tokyo"))
                    .toLocalDate();
                for (TimeRecord r : session) {
                    r.setWorkDate(newWorkDate);
                }
            }
            // Для BREAK_*/CLOCK_OUT workDate не трогаем —
            // ячейка всегда остаётся днём открытия смены (CLOCK_IN)
            record.setRecordedAt(req.getRecordedAt());
        }
        if (req.getNote() != null) record.setNote(req.getNote());

        var editor = userRepository.findById(me.getUserId()).orElseThrow();
        record.setEditedBy(editor);
        record.setEditedAt(Instant.now());

        return toResponse(timeRecordRepository.save(record));
    }

    // Собираем все записи одной смены: от данного CLOCK_IN до ближайшего
    // следующего CLOCK_OUT включительно, либо до следующего CLOCK_IN (не включая его —
    // значит уже началась другая смена, её не трогаем)
    private List<TimeRecord> findSessionRecords(TimeRecord clockIn) {
        List<TimeRecord> all = timeRecordRepository
            .findByUser_IdOrderByRecordedAtAsc(clockIn.getUser().getId());

        List<TimeRecord> session = new ArrayList<>();
        boolean started = false;
        for (TimeRecord r : all) {
            if (!started) {
                if (r.getId().equals(clockIn.getId())) started = true;
                else continue;
            }
            if (started && !r.getId().equals(clockIn.getId())
                    && r.getRecordType() == TimeRecordType.CLOCK_IN) {
                break;
            }
            session.add(r);
            if (r.getRecordType() == TimeRecordType.CLOCK_OUT) break;
        }
        return session;
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