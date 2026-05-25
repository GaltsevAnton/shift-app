package com.shiftapp.reports;

import com.shiftapp.preferences.Preference;
import com.shiftapp.preferences.PreferenceRepository;
import com.shiftapp.preferences.ShiftSlot;
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

@Service
public class ReportService {

    private final UserRepository       userRepository;
    private final PreferenceRepository preferenceRepository;
    private final RestaurantRepository restaurantRepository;
    private final ObjectMapper         objectMapper;

    @Value("${report.service.url:http://localhost:8001}")
    private String reportServiceUrl;

    private static final String hotelName = "ホテル・ヘリテイジ飯能sta．";

    public ReportService(UserRepository userRepository,
                         PreferenceRepository preferenceRepository,
                         RestaurantRepository restaurantRepository,
                         ObjectMapper objectMapper) {
        this.userRepository       = userRepository;
        this.preferenceRepository = preferenceRepository;
        this.restaurantRepository = restaurantRepository;
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