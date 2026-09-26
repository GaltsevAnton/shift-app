package com.shiftapp.kiosk;

import com.shiftapp.kiosk.dto.PunchRequest;
import com.shiftapp.kiosk.dto.PunchResponse;
import com.shiftapp.kiosk.dto.StaffStatusResponse;
import com.shiftapp.notifications.NotificationMailService;
import com.shiftapp.preferences.Preference;
import com.shiftapp.preferences.PreferenceRepository;
import com.shiftapp.preferences.ShiftSlot;
import com.shiftapp.restaurants.RestaurantRepository;
import com.shiftapp.settings.department.Department;
import com.shiftapp.users.User;
import com.shiftapp.users.UserRepository;
import com.shiftapp.users.UserRole;
import com.shiftapp.users.dto.UserResponse;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.beans.factory.annotation.Value;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.*;
import java.util.ArrayList;
import java.util.Base64;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

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

    // ── Список сотрудников для киоска, отсортированный по приоритету отделов ──
    // (транзакция нужна, т.к. departments — lazy ManyToMany, читается здесь же)
    @Transactional(readOnly = true)
    public List<UserResponse> getStaffList(Long restaurantId) {
        List<User> staff = userRepository
            .findAllWithDepartmentsByRestaurantId(restaurantId)   // сразу вместе с отделами — без отдельного запроса на каждого
            .stream()
            .distinct()
            .filter(this::isKioskStaff)
            .collect(Collectors.toCollection(ArrayList::new));

        // stable sort — сохраняет исходный порядок (id desc) внутри одной группы отделов
        staff.sort(Comparator.comparingInt(this::minDepartmentSortOrder));

        return staff.stream().map(UserResponse::from).toList();
    }

    // Кто показывается на киоске: активные STAFF и MANAGER
    private boolean isKioskStaff(User u) {
        return u.isActive() && (u.getRole() == UserRole.STAFF || u.getRole() == UserRole.MANAGER);
    }

    private int minDepartmentSortOrder(User u) {
        if (u.getDepartments() == null || u.getDepartments().isEmpty()) {
            return Integer.MAX_VALUE; // без отдела — в конец списка, но не скрываем
        }
        return u.getDepartments().stream()
            .mapToInt(Department::getSortOrder)
            .min()
            .orElse(Integer.MAX_VALUE);
    }

    // ── Текущий статус сотрудника ──
    @Transactional(readOnly = true)
    public StaffStatusResponse getStatus(Long userId) {
        return buildStatuses(List.of(userId)).get(userId);
    }

    // ── Статусы всех сотрудников киоска одним вызовом (для GET /api/kiosk/statuses) ──
    @Transactional(readOnly = true)
    public Map<Long, StaffStatusResponse> getStatuses(Long restaurantId) {
        List<Long> ids = userRepository
            .findAllByRestaurant_IdOrderByIdDesc(restaurantId)
            .stream()
            .filter(this::isKioskStaff)
            .map(User::getId)
            .toList();
        return buildStatuses(ids);
    }

    // ── Расчёт статусов ──
    // Логика та же, что и раньше:
    //   смена открыта, если есть CLOCK_IN и нет CLOCK_OUT после него (дата не важна)
    //     → статус по записям начиная с последнего CLOCK_IN
    //   иначе → NOT_STARTED + записи за сегодня
    // Но вместо загрузки ВСЕЙ истории каждого сотрудника — несколько лёгких запросов:
    //   2 запроса «время последнего CLOCK_IN / CLOCK_OUT» на всех сразу,
    //   по 1 запросу на каждую открытую смену, 1 запрос «записи за сегодня» на всех остальных.
    private Map<Long, StaffStatusResponse> buildStatuses(List<Long> userIds) {
        Map<Long, StaffStatusResponse> result = new LinkedHashMap<>();
        if (userIds.isEmpty()) return result;

        Map<Long, Instant> lastIn  = lastRecordedAt(userIds, TimeRecordType.CLOCK_IN);
        Map<Long, Instant> lastOut = lastRecordedAt(userIds, TimeRecordType.CLOCK_OUT);

        List<Long> closedIds = new ArrayList<>();
        for (Long id : userIds) {
            Instant in  = lastIn.get(id);
            Instant out = lastOut.get(id);
            boolean shiftOpen = in != null && (out == null || out.isBefore(in));
            if (shiftOpen) {
                result.put(id, buildOpenShift(timeRecordRepository.findRowsSince(id, in)));
            } else {
                closedIds.add(id);
            }
        }

        if (!closedIds.isEmpty()) {
            LocalDate today = LocalDate.now(ZONE);
            Map<Long, List<KioskRecordRow>> todayByUser = timeRecordRepository
                .findRowsByUserIdsAndWorkDate(closedIds, today)
                .stream()
                .collect(Collectors.groupingBy(KioskRecordRow::userId, LinkedHashMap::new, Collectors.toList()));
            for (Long id : closedIds) {
                result.put(id, buildClosed(todayByUser.getOrDefault(id, List.of())));
            }
        }
        return result;
    }

    // userId → время последней записи указанного типа
    private Map<Long, Instant> lastRecordedAt(List<Long> userIds, TimeRecordType type) {
        Map<Long, Instant> map = new HashMap<>();
        for (Object[] row : timeRecordRepository.findLastRecordedAtByUserIds(userIds, type)) {
            map.put((Long) row[0], (Instant) row[1]);
        }
        return map;
    }

    // Смена открыта — статус по записям начиная с последнего CLOCK_IN
    private StaffStatusResponse buildOpenShift(List<KioskRecordRow> shiftRows) {
        StaffStatusResponse res = new StaffStatusResponse();
        res.setStatus("NOT_STARTED");
        for (KioskRecordRow r : shiftRows) {
            switch (r.recordType()) {
                case CLOCK_IN    -> { res.setStatus("WORKING");  res.setClockInAt(r.recordedAt()); }
                case BREAK_START -> { res.setStatus("ON_BREAK"); res.setBreakStartAt(r.recordedAt()); }
                case BREAK_END   -> { res.setStatus("WORKING");  res.setBreakEndAt(r.recordedAt()); }
                case CLOCK_OUT   -> { res.setStatus("FINISHED"); res.setClockOutAt(r.recordedAt()); }
            }
        }
        res.setRecords(toEntries(shiftRows));
        res.setLastPhotoPath(lastPhoto(shiftRows));
        return res;
    }

    // Смена закрыта или не начата — показываем записи за сегодня
    private StaffStatusResponse buildClosed(List<KioskRecordRow> todayRows) {
        StaffStatusResponse res = new StaffStatusResponse();
        res.setStatus("NOT_STARTED");
        res.setRecords(toEntries(todayRows));
        res.setLastPhotoPath(lastPhoto(todayRows));
        return res;
    }

    private List<StaffStatusResponse.TimeRecordEntry> toEntries(List<KioskRecordRow> rows) {
        return rows.stream()
            .map(r -> new StaffStatusResponse.TimeRecordEntry(r.recordType().name(), r.recordedAt()))
            .toList();
    }

    // Последнее фото среди записей (или null)
    private String lastPhoto(List<KioskRecordRow> rows) {
        String photo = null;
        for (KioskRecordRow r : rows) {
            if (r.photoPath() != null) photo = r.photoPath();
        }
        return photo;
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

        // Для CLOCK_OUT/BREAK_START/BREAK_END — берём workDate из последнего CLOCK_IN
        LocalDate workDate = today;
        if (type != TimeRecordType.CLOCK_IN) {
            workDate = timeRecordRepository
                .findFirstByUser_IdAndRecordTypeOrderByRecordedAtDesc(req.getUserId(), TimeRecordType.CLOCK_IN)
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

        // Записи только за этот рабочий день (раньше грузилась вся история и фильтровалась здесь)
        List<TimeRecord> dayRecords = timeRecordRepository
                .findByUser_IdAndWorkDateOrderByRecordedAtAsc(user.getId(), workDate);

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