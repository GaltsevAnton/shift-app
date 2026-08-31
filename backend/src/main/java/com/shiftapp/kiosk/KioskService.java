package com.shiftapp.kiosk;

import com.shiftapp.kiosk.dto.PunchRequest;
import com.shiftapp.kiosk.dto.PunchResponse;
import com.shiftapp.kiosk.dto.StaffStatusResponse;
import com.shiftapp.notifications.NotificationMailService;
import com.shiftapp.preferences.Preference;
import com.shiftapp.preferences.PreferenceRepository;
import com.shiftapp.preferences.ShiftSlot;
import com.shiftapp.notifications.NotificationMailService;
import com.shiftapp.preferences.Preference;
import com.shiftapp.preferences.PreferenceRepository;
import com.shiftapp.preferences.ShiftSlot;
import com.shiftapp.restaurants.RestaurantRepository;
import com.shiftapp.users.User;
import com.shiftapp.users.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.beans.factory.annotation.Value;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.*;
import java.util.Base64;
import java.util.Comparator;
import java.util.List;

@Service
public class KioskService {

    @Value("${kiosk.photo-dir}")
    private String photoDir;
    private static final ZoneId ZONE = ZoneId.of("Asia/Tokyo");

    private final TimeRecordRepository timeRecordRepository;
    private final UserRepository       userRepository;
    private final RestaurantRepository restaurantRepository;
    private final PreferenceRepository preferenceRepository;
    private final NotificationMailService notificationMailService;

    public KioskService(TimeRecordRepository timeRecordRepository,
                        UserRepository userRepository,
                        RestaurantRepository restaurantRepository,
                        PreferenceRepository preferenceRepository,
                        NotificationMailService notificationMailService) {
        this.timeRecordRepository = timeRecordRepository;
        this.userRepository       = userRepository;
        this.restaurantRepository = restaurantRepository;
        this.preferenceRepository = preferenceRepository;
        this.notificationMailService = notificationMailService;
    }

    // ── Текущий статус сотрудника за сегодня ──
    @Transactional(readOnly = true)
    public StaffStatusResponse getStatus(Long userId) {
        // Ищем ВСЕ записи сотрудника, сортируем по времени
        List<TimeRecord> allRecords = timeRecordRepository
            .findByUser_IdOrderByRecordedAtAsc(userId);

        StaffStatusResponse res = new StaffStatusResponse();
        res.setStatus("NOT_STARTED");

        // Находим последний CLOCK_IN без последующего CLOCK_OUT
        TimeRecord lastClockIn  = null;
        TimeRecord lastClockOut = null;

        for (TimeRecord r : allRecords) {
            if (r.getRecordType() == TimeRecordType.CLOCK_IN)  lastClockIn  = r;
            if (r.getRecordType() == TimeRecordType.CLOCK_OUT) lastClockOut = r;
        }

        // Смена открыта если есть CLOCK_IN и нет CLOCK_OUT после него
        boolean shiftOpen = lastClockIn != null &&
            (lastClockOut == null || lastClockOut.getRecordedAt().isBefore(lastClockIn.getRecordedAt()));

        if (!shiftOpen) {
            // Смена закрыта или не начата — показываем записи за сегодня
            LocalDate today = LocalDate.now(ZONE);
            List<TimeRecord> todayRecords = allRecords.stream()
                .filter(r -> r.getWorkDate().equals(today))
                .toList();
            res.setStatus("NOT_STARTED");
            res.setRecords(todayRecords.stream()
                .map(r -> new StaffStatusResponse.TimeRecordEntry(r.getRecordType().name(), r.getRecordedAt()))
                .toList());
            todayRecords.stream()
                .filter(r -> r.getPhotoPath() != null)
                .reduce((a, b) -> b)
                .ifPresent(r -> res.setLastPhotoPath(r.getPhotoPath()));
            return res;
        }

        // Смена открыта — берём записи начиная с последнего CLOCK_IN
        final TimeRecord openClockIn = lastClockIn;
        List<TimeRecord> shiftRecords = allRecords.stream()
            .filter(r -> !r.getRecordedAt().isBefore(openClockIn.getRecordedAt()))
            .toList();

        for (TimeRecord r : shiftRecords) {
            switch (r.getRecordType()) {
                case CLOCK_IN    -> { res.setStatus("WORKING");  res.setClockInAt(r.getRecordedAt()); }
                case BREAK_START -> { res.setStatus("ON_BREAK"); res.setBreakStartAt(r.getRecordedAt()); }
                case BREAK_END   -> { res.setStatus("WORKING");  res.setBreakEndAt(r.getRecordedAt()); }
                case CLOCK_OUT   -> { res.setStatus("FINISHED"); res.setClockOutAt(r.getRecordedAt()); }
            }
        }

        res.setRecords(shiftRecords.stream()
            .map(r -> new StaffStatusResponse.TimeRecordEntry(r.getRecordType().name(), r.getRecordedAt()))
            .toList());

        shiftRecords.stream()
            .filter(r -> r.getPhotoPath() != null)
            .reduce((a, b) -> b)
            .ifPresent(r -> res.setLastPhotoPath(r.getPhotoPath()));

        return res;
    }

    // ── Фиксация прихода/ухода ──
    @Transactional
    public PunchResponse punch(PunchRequest req) {
        User user = userRepository.findById(req.getUserId())
            .orElseThrow(() -> new IllegalArgumentException("User not found"));

        TimeRecordType type;
        try {
            type = TimeRecordType.valueOf(req.getRecordType());
        } catch (IllegalArgumentException e) {
            throw new IllegalArgumentException("Invalid record type: " + req.getRecordType());
        }

        // Валидация: проверяем что действие допустимо для текущего статуса
        StaffStatusResponse current = getStatus(req.getUserId());
        validatePunch(current.getStatus(), type);

        Instant now      = Instant.now();
        LocalDate today  = LocalDate.now(ZONE);
        
        // Для CLOCK_OUT/BREAK_START/BREAK_END — берём workDate из открытого CLOCK_IN
        LocalDate workDate = today;
        if (type != TimeRecordType.CLOCK_IN) {
            workDate = timeRecordRepository.findByUser_IdOrderByRecordedAtAsc(req.getUserId())
                .stream()
                .filter(r -> r.getRecordType() == TimeRecordType.CLOCK_IN)
                .reduce((first, second) -> second)
                .map(TimeRecord::getWorkDate)
                .orElse(today);
        }
        
        // Сохраняем фото если есть
        String photoPath = null;
        if (req.getPhotoBase64() != null && !req.getPhotoBase64().isBlank()) {
            photoPath = savePhoto(req.getUserId(), type, workDate, now, req.getPhotoBase64());
        }
        
        TimeRecord record = new TimeRecord();
        record.setUser(user);
        record.setRestaurant(user.getRestaurant());
        record.setRecordType(type);
        record.setRecordedAt(now);
        record.setWorkDate(workDate);
        record.setPhotoPath(photoPath);

        TimeRecord saved = timeRecordRepository.save(record);

        checkAndNotify(user, type, workDate, now);

        return new PunchResponse(
            saved.getId(),
            saved.getRecordType().name(),
            saved.getRecordedAt(),
            user.getFullName(),
            photoPath
        );
    }

    // ── 遅刻/早退/シフトなし出勤の判定と通知 ────────────────────────────────
    private void checkAndNotify(User user, TimeRecordType type, LocalDate workDate, Instant recordedAt) {
        if (type != TimeRecordType.CLOCK_IN && type != TimeRecordType.CLOCK_OUT) return;

        Preference pref = preferenceRepository
                .findByRestaurant_IdAndWorkDateBetweenWithSlots(user.getRestaurant().getId(), workDate, workDate)
                .stream()
                .filter(p -> p.getUser().getId().equals(user.getId()))
                .findFirst()
                .orElse(null);

        boolean hasPlan = pref != null && !pref.isOff() && !pref.getSlots().isEmpty();

        if (!hasPlan) {
            if (type == TimeRecordType.CLOCK_IN) {
                ZonedDateTime nowJst = recordedAt.atZone(ZONE);
                notificationMailService.notifyUnscheduledArrival(
                        user.getRestaurant().getId(), user.getFullName(), workDate, nowJst.toLocalTime().withNano(0));
            }
            return;
        }

        // このシフトの何番目のセッションか（同日複数シフト対応）を数え、対応するスロットを取得
        List<ShiftSlot> sortedSlots = pref.getSlots().stream()
                .filter(sl -> sl.getStartTime() != null)
                .sorted(Comparator.comparing(ShiftSlot::getStartTime))
                .toList();
        if (sortedSlots.isEmpty()) return;

        List<TimeRecord> dayRecords = timeRecordRepository.findByUser_IdOrderByRecordedAtAsc(user.getId())
                .stream()
                .filter(r -> r.getWorkDate().equals(workDate))
                .toList();

        int clockInCount = 0;
        for (TimeRecord r : dayRecords) {
            if (r.getRecordType() == TimeRecordType.CLOCK_IN) clockInCount++;
        }
        int sessionIndex = Math.max(clockInCount - 1, 0); // 今回のCLOCK_INが何番目のセッションか
        if (sessionIndex >= sortedSlots.size()) return;
        ShiftSlot slot = sortedSlots.get(sessionIndex);

        ZonedDateTime nowJst = recordedAt.atZone(ZONE);

        if (type == TimeRecordType.CLOCK_IN && slot.getStartTime() != null) {
            ZonedDateTime planStart = workDate.atTime(slot.getStartTime()).atZone(ZONE);
            if (nowJst.isAfter(planStart)) {
                notificationMailService.notifyLateArrival(
                        user.getRestaurant().getId(), user.getFullName(), workDate,
                        slot.getStartTime(), nowJst.toLocalTime().withNano(0));
            }
        }

        if (type == TimeRecordType.CLOCK_OUT && slot.getEndTime() != null) {
            ZonedDateTime planEnd = workDate.atTime(slot.getEndTime()).atZone(ZONE);
            boolean nextDay = slot.isNextDay() ||
                    (slot.getStartTime() != null && !slot.getEndTime().isAfter(slot.getStartTime()));
            if (nextDay) planEnd = planEnd.plusDays(1);

            if (nowJst.isBefore(planEnd)) {
                notificationMailService.notifyEarlyDeparture(
                        user.getRestaurant().getId(), user.getFullName(), workDate,
                        slot.getEndTime(), nowJst.toLocalTime().withNano(0));
            }
        }
    }

    // ── Валидация допустимых действий ──
    private void validatePunch(String currentStatus, TimeRecordType type) {
        switch (currentStatus) {
            case "NOT_STARTED", "FINISHED" -> {  // ← добавили FINISHED
                if (type != TimeRecordType.CLOCK_IN)
                    throw new IllegalArgumentException("出勤打刻が必要です");
            }
            case "WORKING" -> {
                if (type != TimeRecordType.BREAK_START && type != TimeRecordType.CLOCK_OUT)
                    throw new IllegalArgumentException("無効な操作です");
            }
            case "ON_BREAK" -> {
                if (type != TimeRecordType.BREAK_END)
                    throw new IllegalArgumentException("休憩終了打刻が必要です");
            }
        }
    }

    // ── Save photo to disk ──
    private String savePhoto(Long userId, TimeRecordType type,
                             LocalDate date, Instant now, String base64) {
        try {
            String dateDir  = date.toString(); // "2026-06-09"
            String fileName = userId + "_" + type.name().toLowerCase()
                            + "_" + now.getEpochSecond() + ".jpg";
            Path dir  = Paths.get(photoDir, dateDir);
            Files.createDirectories(dir);
            Path file = dir.resolve(fileName);

            // Reamove data:image/jpeg;base64
            String data = base64.contains(",") ? base64.split(",")[1] : base64;
            byte[] bytes = Base64.getDecoder().decode(data);
            Files.write(file, bytes);

            return "/photos/" + dateDir + "/" + fileName;
        } catch (IOException e) {
            // Логируем но не падаем — фото не критично
            System.err.println("Failed to save photo: " + e.getMessage());
            return null;
        }
    }
}