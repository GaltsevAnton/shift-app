package com.shiftapp.reports;

import com.shiftapp.preferences.Preference;
import com.shiftapp.preferences.PreferenceRepository;
import com.shiftapp.preferences.ShiftSlot;
import com.shiftapp.kiosk.TimeRecord;
import com.shiftapp.kiosk.TimeRecordRepository;
import com.shiftapp.kiosk.TimeRecordType;
import com.shiftapp.settings.breakrule.BreakRule;
import com.shiftapp.settings.breakrule.BreakRuleRepository;
import com.shiftapp.restaurants.RestaurantRepository;
import com.shiftapp.settings.department.Department;
import com.shiftapp.users.User;
import com.shiftapp.users.UserRepository;
import com.shiftapp.users.UserRole;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.client.RestTemplate;

import java.time.LocalDate;
import java.time.YearMonth;
import java.util.*;
import java.time.ZoneId;
import java.time.OffsetDateTime;
import java.time.Duration;
import java.time.Instant;

@Service
public class ReportService {

    private final UserRepository       userRepository;
    private final PreferenceRepository preferenceRepository;
    private final RestaurantRepository restaurantRepository;
    private final TimeRecordRepository timeRecordRepository;
    private final BreakRuleRepository  breakRuleRepository;
    private final ObjectMapper         objectMapper;

    @Value("${report.service.url:http://localhost:8001}")
    private String reportServiceUrl;

    private static final String hotelName = "ホテル・ヘリテイジ飯能sta．";

    public ReportService(UserRepository userRepository,
                PreferenceRepository preferenceRepository,
                RestaurantRepository restaurantRepository,
                TimeRecordRepository timeRecordRepository,
                BreakRuleRepository breakRuleRepository,
                ObjectMapper objectMapper) {
        this.userRepository       = userRepository;
        this.preferenceRepository = preferenceRepository;
        this.restaurantRepository = restaurantRepository;
        this.timeRecordRepository = timeRecordRepository;
        this.breakRuleRepository  = breakRuleRepository;
        this.objectMapper         = objectMapper;
    }

    // ── Публичные методы ─────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public byte[] generateShiftDept(Long restaurantId, String ym, String department) {
        Map<String, Object> payload = buildPayload(restaurantId, ym, department);
        return callPython("/generate/shift/dept", payload);
    }

    @Transactional(readOnly = true)
    public byte[] generateShiftAll(Long restaurantId, String ym) {
        Map<String, Object> payload = buildPayload(restaurantId, ym, null);
        return callPython("/generate/shift/all", payload);
    }

    @Transactional(readOnly = true)
    public byte[] generateTimesheet(Long restaurantId, String ym) {
        Map<String, Object> payload = buildPayload(restaurantId, ym, null);
        return callPython("/generate/timesheet", payload);
    }

    @Transactional(readOnly = true)
    public byte[] generateShiftFiltered(Long restaurantId, String ym, List<Long> userIds) {
        Map<String, Object> payload = buildPayloadForUsers(restaurantId, ym, userIds);
        return callPython("/generate/shift/all", payload);
    }

    @Transactional(readOnly = true)
    public byte[] generateAttendanceTimesheet(Long restaurantId, String ym) {
        Map<String, Object> payload = buildAttendancePayload(restaurantId, ym);
        return callPython("/generate/attendance/timesheet", payload);
    }

    @Transactional(readOnly = true)
    public byte[] generateAttendanceList(Long restaurantId, String ym) {
        Map<String, Object> payload = buildAttendancePayload(restaurantId, ym);
        return callPython("/generate/attendance/list", payload);
    }

    @Transactional(readOnly = true)
    public byte[] generateAttendanceSessions(Long restaurantId, LocalDate from, LocalDate to, List<Long> userIds) {
        Map<String, Object> payload = buildAttendanceSessionsPayload(restaurantId, from, to, userIds);
        return callPython("/generate/attendance/sessions", payload);
    }
    // ── Сборка данных ────────────────────────────────────────────────────

    private Map<String, Object> buildPayload(Long restaurantId, String ym, String department) {
        YearMonth yearMonth  = YearMonth.parse(ym);
        LocalDate monthStart = yearMonth.atDay(1);
        LocalDate monthEnd   = yearMonth.atEndOfMonth();

        List<User> allStaff = userRepository.findAllByRestaurant_IdOrderByIdDesc(restaurantId)
                .stream()
                .filter(u -> u.getRole() == UserRole.STAFF && u.isActive())
                .toList();

        List<User> staffList = department == null ? allStaff : allStaff.stream()
                .filter(u -> u.getDepartments().stream()
                        .anyMatch(d -> d.getName().equals(department)))
                .toList();

        List<Preference> allPrefs = preferenceRepository
                .findByRestaurant_IdAndWorkDateBetweenWithSlots(restaurantId, monthStart, monthEnd);

        Map<Long, Map<LocalDate, Preference>> byUser = new HashMap<>();
        for (Preference p : allPrefs) {
            byUser.computeIfAbsent(p.getUser().getId(), k -> new HashMap<>())
                  .put(p.getWorkDate(), p);
        }

        List<Map<String, Object>> staffData = new ArrayList<>();
        for (User u : staffList) {
            Map<LocalDate, Preference> prefMap =
                    byUser.getOrDefault(u.getId(), Collections.emptyMap());

            List<Map<String, Object>> days = new ArrayList<>();
            for (LocalDate date = monthStart; !date.isAfter(monthEnd); date = date.plusDays(1)) {
                Preference p = prefMap.get(date);
                days.add(buildDay(date, p));
            }

            Map<String, Object> staffEntry = new LinkedHashMap<>();
            staffEntry.put("userId",      u.getId());
            staffEntry.put("userName",    u.getFullName());
            staffEntry.put("position",    u.getPosition());
            staffEntry.put("departments", u.getDepartments().stream()
                    .map(Department::getName).toList());
            staffEntry.put("days", days);
            staffData.add(staffEntry);
        }

        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("ym",         ym);
        payload.put("hotelName",  hotelName);
        payload.put("department", department);
        payload.put("staff",      staffData);
        return payload;
    }

    private Map<String, Object> buildPayloadForUsers(Long restaurantId, String ym, List<Long> userIds) {
        YearMonth yearMonth  = YearMonth.parse(ym);
        LocalDate monthStart = yearMonth.atDay(1);
        LocalDate monthEnd   = yearMonth.atEndOfMonth();
    
        List<User> allStaff = userRepository.findAllByRestaurant_IdOrderByIdDesc(restaurantId)
                .stream()
                .filter(u -> u.getRole() == UserRole.STAFF && u.isActive())
                .filter(u -> userIds.contains(u.getId()))
                .toList();
    
        List<Preference> allPrefs = preferenceRepository
                .findByRestaurant_IdAndWorkDateBetweenWithSlots(restaurantId, monthStart, monthEnd);
    
        Map<Long, Map<LocalDate, Preference>> byUser = new HashMap<>();
        for (Preference p : allPrefs) {
            byUser.computeIfAbsent(p.getUser().getId(), k -> new HashMap<>())
                  .put(p.getWorkDate(), p);
        }
    
        List<Map<String, Object>> staffData = new ArrayList<>();
        for (User u : allStaff) {
            Map<LocalDate, Preference> prefMap =
                    byUser.getOrDefault(u.getId(), Collections.emptyMap());
    
            List<Map<String, Object>> days = new ArrayList<>();
            for (LocalDate date = monthStart; !date.isAfter(monthEnd); date = date.plusDays(1)) {
                days.add(buildDay(date, prefMap.get(date)));
            }
    
            Map<String, Object> staffEntry = new LinkedHashMap<>();
            staffEntry.put("userId",      u.getId());
            staffEntry.put("userName",    u.getFullName());
            staffEntry.put("position",    u.getPosition());
            staffEntry.put("departments", u.getDepartments().stream()
                    .map(Department::getName).toList());
            staffEntry.put("days", days);
            staffData.add(staffEntry);
        }
    
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("ym",         ym);
        payload.put("hotelName",  hotelName);
        payload.put("department", null);
        payload.put("staff",      staffData);
        return payload;
    }

    private Map<String, Object> buildAttendancePayload(Long restaurantId, String ym) {
        YearMonth yearMonth  = YearMonth.parse(ym);
        LocalDate monthStart = yearMonth.atDay(1);
        LocalDate monthEnd   = yearMonth.atEndOfMonth();

        List<User> allStaff = userRepository.findAllByRestaurant_IdOrderByIdDesc(restaurantId)
                .stream()
                .filter(u -> (u.getRole() == UserRole.STAFF || u.getRole() == UserRole.MANAGER) && u.isActive())
                .toList();

        List<TimeRecord> records = timeRecordRepository.findByRestaurantAndDateRange(restaurantId, monthStart, monthEnd);
        Map<Long, Map<LocalDate, List<TimeRecord>>> byUser = new HashMap<>();
        for (TimeRecord t : records) {
            byUser.computeIfAbsent(t.getUser().getId(), k -> new HashMap<>())
                  .computeIfAbsent(t.getWorkDate(), k -> new ArrayList<>())
                  .add(t);
        }

        List<Preference> allPrefs = preferenceRepository
                .findByRestaurant_IdAndWorkDateBetweenWithSlots(restaurantId, monthStart, monthEnd);
        Map<Long, Map<LocalDate, Preference>> prefByUser = new HashMap<>();
        for (Preference p : allPrefs) {
            prefByUser.computeIfAbsent(p.getUser().getId(), k -> new HashMap<>())
                      .put(p.getWorkDate(), p);
        }

        List<BreakRule> breakRules = breakRuleRepository.findByRestaurant_IdOrderByThresholdMinutesAsc(restaurantId);

        List<Map<String, Object>> staffData = new ArrayList<>();
        for (User u : allStaff) {
            Map<LocalDate, List<TimeRecord>> recMap = byUser.getOrDefault(u.getId(), Collections.emptyMap());
            Map<LocalDate, Preference> prefMap = prefByUser.getOrDefault(u.getId(), Collections.emptyMap());

            List<Map<String, Object>> days = new ArrayList<>();
            for (LocalDate date = monthStart; !date.isAfter(monthEnd); date = date.plusDays(1)) {
                days.add(buildAttendanceDay(date, recMap.get(date), prefMap.get(date), breakRules));
            }

            Map<String, Object> staffEntry = new LinkedHashMap<>();
            staffEntry.put("userId",      u.getId());
            staffEntry.put("userName",    u.getFullName());
            staffEntry.put("position",    u.getPosition());
            staffEntry.put("departments", u.getDepartments().stream()
                    .map(Department::getName).toList());
            staffEntry.put("days", days);
            staffData.add(staffEntry);
        }

        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("ym",        ym);
        payload.put("hotelName", hotelName);
        payload.put("staff",     staffData);
        return payload;
    }

    private Map<String, Object> buildAttendanceDay(LocalDate date, List<TimeRecord> recs, Preference pref, List<BreakRule> breakRules) {
        Map<String, Object> day = new LinkedHashMap<>();
        day.put("date", date.toString());

        // Группируем пробивки в сессии: CLOCK_IN → (BREAK_START/END) → CLOCK_OUT
        List<Map<String, Object>> sessions = new ArrayList<>();
        if (recs != null && !recs.isEmpty()) {
            List<TimeRecord> sorted = new ArrayList<>(recs);
            sorted.sort(Comparator.comparing(TimeRecord::getRecordedAt));

            Map<String, Object> current = null;
            for (TimeRecord r : sorted) {
                switch (r.getRecordType()) {
                    case CLOCK_IN -> {
                        if (current != null) sessions.add(current); // незакрытая предыдущая
                        current = new LinkedHashMap<>();
                        current.put("clockIn",    toJstIso(r.getRecordedAt()));
                        current.put("clockOut",   null);
                        current.put("breakStart", null);
                        current.put("breakEnd",   null);
                    }
                    case BREAK_START -> { if (current != null) current.put("breakStart", toJstIso(r.getRecordedAt())); }
                    case BREAK_END   -> { if (current != null) current.put("breakEnd",   toJstIso(r.getRecordedAt())); }
                    case CLOCK_OUT   -> {
                        if (current != null) {
                            current.put("clockOut", toJstIso(r.getRecordedAt()));
                            sessions.add(current);
                            current = null;
                        }
                    }
                }
            }
            if (current != null) sessions.add(current); // смена ещё открыта
        }

        // Гибридный расчёт休憩/実働 для каждой сессии: приоритет реальной пробивке, иначе — по 休憩ルール
        for (Map<String, Object> session : sessions) {
            String ci = (String) session.get("clockIn");
            String co = (String) session.get("clockOut");
            String bs = (String) session.get("breakStart");
            String be = (String) session.get("breakEnd");

            Integer grossMin = minutesBetweenIso(ci, co);
            int breakMin;
            if (bs != null && be != null) {
                Integer actualBreak = minutesBetweenIso(bs, be);
                breakMin = (actualBreak != null && actualBreak > 0) ? actualBreak : 0;
            } else if (grossMin != null) {
                breakMin = autoBreakMinutes(grossMin, breakRules);
            } else {
                breakMin = 0;
            }
            Integer workMin = grossMin != null ? Math.max(grossMin - breakMin, 0) : null;

            session.put("breakMinutes", breakMin);
            session.put("workMinutes",  workMin);
        }

        day.put("sessions", sessions);

        boolean hasShift = pref != null && !pref.isOff() && !pref.getSlots().isEmpty();
        day.put("hasShift", hasShift);
        if (hasShift) {
            String shiftStart = pref.getSlots().stream()
                    .map(ShiftSlot::getStartTime).filter(Objects::nonNull)
                    .map(Object::toString).sorted().findFirst().orElse(null);
            String shiftEnd = pref.getSlots().stream()
                    .map(ShiftSlot::getEndTime).filter(Objects::nonNull)
                    .map(Object::toString).sorted(Comparator.reverseOrder()).findFirst().orElse(null);
            day.put("shiftStart", shiftStart);
            day.put("shiftEnd",   shiftEnd);
        } else {
            day.put("shiftStart", null);
            day.put("shiftEnd",   null);
        }

        return day;
    }

    private Integer minutesBetweenIso(String startIso, String endIso) {
        if (startIso == null || endIso == null) return null;
        try {
            OffsetDateTime s = OffsetDateTime.parse(startIso);
            OffsetDateTime e = OffsetDateTime.parse(endIso);
            long mins = Duration.between(s, e).toMinutes();
            return mins > 0 ? (int) mins : 0;
        } catch (Exception ex) {
            return null;
        }
    }

    private int autoBreakMinutes(int grossMinutes, List<BreakRule> rules) {
        return rules.stream()
                .filter(r -> grossMinutes > r.getThresholdMinutes())
                .max(Comparator.comparingInt(BreakRule::getThresholdMinutes))
                .map(BreakRule::getBreakMinutes)
                .orElse(0);
    }

    private Map<String, Object> buildAttendanceSessionsPayload(Long restaurantId, LocalDate from, LocalDate to, List<Long> userIds) {
        List<TimeRecord> records = timeRecordRepository.findByRestaurantAndDateRange(restaurantId, from, to);

        Map<Long, List<TimeRecord>> byUser = new LinkedHashMap<>();
        for (TimeRecord t : records) {
            Long uid = t.getUser().getId();
            if (userIds != null && !userIds.isEmpty() && !userIds.contains(uid)) continue;
            byUser.computeIfAbsent(uid, k -> new ArrayList<>()).add(t);
        }

        // Плановые смены за тот же период — для колонки シフト予定
        List<Preference> allPrefs = preferenceRepository
                .findByRestaurant_IdAndWorkDateBetweenWithSlots(restaurantId, from, to);
        Map<String, Preference> prefByUserDate = new HashMap<>();
        for (Preference p : allPrefs) {
            prefByUserDate.put(p.getUser().getId() + "_" + p.getWorkDate(), p);
        }

        // Группируем пробивки в сессии: CLOCK_IN → (BREAK_START/END) → CLOCK_OUT
        List<Map<String, Object>> sessions = new ArrayList<>();
        for (List<TimeRecord> recs : byUser.values()) {
            List<TimeRecord> sorted = new ArrayList<>(recs);
            sorted.sort(Comparator.comparing(TimeRecord::getRecordedAt));

            Map<String, Object> current = null;
            for (TimeRecord r : sorted) {
                switch (r.getRecordType()) {
                    case CLOCK_IN -> {
                        if (current != null) sessions.add(current); // незакрытая предыдущая — сохраняем как есть
                        current = new LinkedHashMap<>();
                        current.put("userId",     r.getUser().getId());
                        current.put("userName",   r.getUser().getFullName());
                        current.put("workDate",   r.getWorkDate().toString());
                        current.put("clockIn",    toJstIso(r.getRecordedAt()));
                        current.put("clockOut",   null);
                        current.put("breakStart", null);
                        current.put("breakEnd",   null);

                        Preference pref = prefByUserDate.get(r.getUser().getId() + "_" + r.getWorkDate());
                        if (pref != null && !pref.isOff() && !pref.getSlots().isEmpty()) {
                            String shiftStart = pref.getSlots().stream()
                                    .map(ShiftSlot::getStartTime).filter(Objects::nonNull)
                                    .map(Object::toString).sorted().findFirst().orElse(null);
                            String shiftEnd = pref.getSlots().stream()
                                    .map(ShiftSlot::getEndTime).filter(Objects::nonNull)
                                    .map(Object::toString).sorted(Comparator.reverseOrder()).findFirst().orElse(null);
                            current.put("shiftStart", shiftStart);
                            current.put("shiftEnd",   shiftEnd);
                        } else {
                            current.put("shiftStart", null);
                            current.put("shiftEnd",   null);
                        }
                    }
                    case BREAK_START -> { if (current != null) current.put("breakStart", toJstIso(r.getRecordedAt())); }
                    case BREAK_END   -> { if (current != null) current.put("breakEnd",   toJstIso(r.getRecordedAt())); }
                    case CLOCK_OUT   -> {
                        if (current != null) {
                            current.put("clockOut", toJstIso(r.getRecordedAt()));
                            sessions.add(current);
                            current = null;
                        }
                    }
                }
            }
            if (current != null) sessions.add(current); // смена ещё открыта
        }

        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("hotelName", hotelName);
        payload.put("fromDate",  from.toString());
        payload.put("toDate",    to.toString());
        payload.put("sessions",  sessions);
        return payload;
    }
    
    private String toJstIso(Instant instant) {
        if (instant == null) return null;
        return instant.atZone(ZoneId.of("Asia/Tokyo")).toOffsetDateTime().toString();
    }

    private Map<String, Object> buildDay(LocalDate date, Preference p) {
        Map<String, Object> day = new LinkedHashMap<>();
        day.put("date", date.toString());

        if (p == null || p.isOff() || p.getSlots().isEmpty()) {
            day.put("off",   true);
            day.put("slots", Collections.emptyList());
            return day;
        }

        List<Map<String, Object>> slots = new ArrayList<>();
        for (ShiftSlot s : p.getSlots()) {
            Map<String, Object> slot = new LinkedHashMap<>();
            slot.put("startTime", s.getStartTime() != null ? s.getStartTime().toString() : null);
            slot.put("endTime",   s.isLast() ? null : (s.getEndTime() != null ? s.getEndTime().toString() : null));
            slot.put("last",      s.isLast());
            slot.put("workplace", s.getWorkplace());
            slots.add(slot);
        }

        day.put("off",   false);
        day.put("slots", slots);
        return day;
    }

    // ── Вызов Python-сервиса ─────────────────────────────────────────────

    private byte[] callPython(String path, Map<String, Object> payload) {
        try {
            RestTemplate restTemplate = new RestTemplate();

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);

            String json = new String(
                    objectMapper.writeValueAsBytes(payload),
                    java.nio.charset.StandardCharsets.UTF_8);

            HttpEntity<String> entity = new HttpEntity<>(json, headers);

            ResponseEntity<byte[]> response = restTemplate.exchange(
                    reportServiceUrl + path,
                    HttpMethod.POST,
                    entity,
                    byte[].class
            );

            return response.getBody();

        } catch (Exception e) {
            throw new RuntimeException("Failed to call report service: " + e.getMessage(), e);
        }
    }
}