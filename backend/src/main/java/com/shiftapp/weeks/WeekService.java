package com.shiftapp.weeks;

import com.shiftapp.preferences.Preference;
import com.shiftapp.preferences.PreferenceRepository;
import com.shiftapp.restaurants.RestaurantRepository;
import com.shiftapp.users.UserRepository;
import com.shiftapp.weeks.dto.*;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.*;
import java.time.temporal.TemporalAdjusters;
import java.util.*;

@Service
public class WeekService {

    private final WeekStatusRepository weekStatusRepository;
    private final RestaurantRepository restaurantRepository;
    private final UserRepository userRepository;
    private final PreferenceRepository preferenceRepository;

    public WeekService(WeekStatusRepository weekStatusRepository,
                       RestaurantRepository restaurantRepository,
                       UserRepository userRepository,
                       PreferenceRepository preferenceRepository) {
        this.weekStatusRepository = weekStatusRepository;
        this.restaurantRepository = restaurantRepository;
        this.userRepository = userRepository;
        this.preferenceRepository = preferenceRepository;
    }

    // ===== helpers =====
    public static LocalDate mondayOf(LocalDate d) {
        return d.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
    }

    private WeekStatusType getStatusOrDefault(Long restaurantId, LocalDate weekStart) {
        return weekStatusRepository.findByRestaurant_IdAndWeekStart(restaurantId, weekStart)
                .map(WeekStatus::getStatus)
                .orElse(WeekStatusType.RECEIVING);
    }

    // ===== STAFF: weeks list by month =====
    @Transactional(readOnly = true)
    public List<WeekRowResponse> staffWeeks(Long restaurantId, YearMonth ym) {
        LocalDate monthStart = ym.atDay(1);
        LocalDate monthEnd = ym.atEndOfMonth();

        LocalDate firstWeekStart = mondayOf(monthStart);
        LocalDate lastWeekStart = mondayOf(monthEnd);

        List<WeekRowResponse> out = new ArrayList<>();
        for (LocalDate ws = firstWeekStart; !ws.isAfter(lastWeekStart); ws = ws.plusWeeks(1)) {
            WeekRowResponse r = new WeekRowResponse();
            r.setWeekStart(ws);
            r.setWeekEnd(ws.plusDays(6));
            r.setStatus(getStatusOrDefault(restaurantId, ws));
            out.add(r);
        }
        return out;
    }

    // ===== STAFF: get one week =====
    @Transactional(readOnly = true)
    public StaffWeekResponse staffWeek(Long restaurantId, Long userId, LocalDate weekStart) {
        LocalDate ws = mondayOf(weekStart);
        LocalDate we = ws.plusDays(6);

        var user = userRepository.findById(userId).orElseThrow();
        if (!user.getRestaurant().getId().equals(restaurantId)) {
            throw new IllegalArgumentException("User belongs to another restaurant");
        }

        WeekStatusType status = getStatusOrDefault(restaurantId, ws);

        List<Preference> prefs = preferenceRepository.findByUser_IdAndWorkDateBetween(userId, ws, we);
        Map<LocalDate, Preference> map = new HashMap<>();
        for (Preference p : prefs) map.put(p.getWorkDate(), p);

        List<StaffWeekDay> days = new ArrayList<>();
        for (int i = 0; i < 7; i++) {
            LocalDate d = ws.plusDays(i);
            Preference p = map.get(d);

            StaffWeekDay day = new StaffWeekDay();
            day.setDate(d);

            if (p == null) {
                day.setOff(false);
                day.setStartTime(null);
                day.setEndTime(null);
            } else {
                if (p.getStartTime() == null || p.getEndTime() == null) {
                    day.setOff(true);
                    day.setStartTime(null);
                    day.setEndTime(null);
                } else {
                    day.setOff(false);
                    day.setStartTime(p.getStartTime());
                    day.setEndTime(p.getEndTime());
                }
            }
            days.add(day);
        }

        StaffWeekResponse res = new StaffWeekResponse();
        res.setStatus(status);
        res.setDays(days);
        return res;
    }

    // ===== STAFF: save week =====
    @Transactional
    public String staffSaveWeek(Long restaurantId, Long userId, StaffWeekSaveRequest req) {
        LocalDate ws = mondayOf(req.getWeekStart());
        WeekStatusType status = getStatusOrDefault(restaurantId, ws);

        if (status != WeekStatusType.RECEIVING) {
            throw new IllegalArgumentException("Week is locked (status=" + status + ")");
        }

        LocalDate we = ws.plusDays(6);

        if (req.getDays() == null || req.getDays().size() != 7) {
            throw new IllegalArgumentException("days must be 7 items");
        }

        var user = userRepository.findById(userId).orElseThrow();
        if (!user.getRestaurant().getId().equals(restaurantId)) {
            throw new IllegalArgumentException("User belongs to another restaurant");
        }

        var restaurant = restaurantRepository.findById(restaurantId).orElseThrow();

        for (var d : req.getDays()) {
            if (d.getDate().isBefore(ws) || d.getDate().isAfter(we)) {
                throw new IllegalArgumentException("date out of week: " + d.getDate());
            }

            if (!d.isOff()) {
                if (d.getStartTime() == null || d.getEndTime() == null) {
                    throw new IllegalArgumentException("start/end required when not off");
                }

                int startMin = d.getStartTime().getHour() * 60 + d.getStartTime().getMinute();
                int endMin = d.getEndTime().getHour() * 60 + d.getEndTime().getMinute();

                if (endMin <= startMin) endMin += 24 * 60;

                int duration = endMin - startMin;

                if (duration < 30) throw new IllegalArgumentException("duration too short (min 30 minutes)");
                if (duration > 16 * 60) throw new IllegalArgumentException("duration too long (max 16 hours)");
            }

            Preference p = preferenceRepository.findByUser_IdAndWorkDate(userId, d.getDate())
                    .orElseGet(Preference::new);

            p.setUser(user);
            p.setRestaurant(restaurant);
            p.setWorkDate(d.getDate());

            if (d.isOff()) {
                p.setStartTime(null);
                p.setEndTime(null);
            } else {
                p.setStartTime(d.getStartTime());
                p.setEndTime(d.getEndTime());
            }
            preferenceRepository.save(p);
        }

        return "SAVED";
    }

    // ===== STAFF: copy prev week =====
    @Transactional
    public String staffCopyPrevWeek(Long restaurantId, Long userId, LocalDate weekStart) {
        LocalDate dstWs = mondayOf(weekStart);
        WeekStatusType status = getStatusOrDefault(restaurantId, dstWs);
        if (status != WeekStatusType.RECEIVING) {
            throw new IllegalArgumentException("Week is locked (status=" + status + ")");
        }

        var user = userRepository.findById(userId).orElseThrow();
        if (!user.getRestaurant().getId().equals(restaurantId)) {
            throw new IllegalArgumentException("User belongs to another restaurant");
        }

        LocalDate srcWs = dstWs.minusWeeks(1);
        LocalDate srcWe = srcWs.plusDays(6);

        List<Preference> src = preferenceRepository.findByUser_IdAndWorkDateBetween(userId, srcWs, srcWe);
        Map<LocalDate, Preference> srcMap = new HashMap<>();
        for (Preference p : src) srcMap.put(p.getWorkDate(), p);

        var restaurant = restaurantRepository.findById(restaurantId).orElseThrow();

        int copied = 0;
        for (int i = 0; i < 7; i++) {
            LocalDate srcDate = srcWs.plusDays(i);
            LocalDate dstDate = dstWs.plusDays(i);

            Preference from = srcMap.get(srcDate);
            if (from == null) continue;

            Preference to = preferenceRepository.findByUser_IdAndWorkDate(userId, dstDate)
                    .orElseGet(Preference::new);

            to.setUser(user);
            to.setRestaurant(restaurant);
            to.setWorkDate(dstDate);
            to.setStartTime(from.getStartTime());
            to.setEndTime(from.getEndTime());
            preferenceRepository.save(to);

            copied++;
        }

        return "COPIED=" + copied;
    }

    // ===== MANAGER: set week status =====
    @Transactional
    public String managerSetWeekStatus(Long restaurantId, Long managerId, LocalDate weekStart, WeekStatusType status) {
        LocalDate ws = mondayOf(weekStart);

        WeekStatus row = weekStatusRepository.findByRestaurant_IdAndWeekStart(restaurantId, ws)
                .orElseGet(WeekStatus::new);

        row.setRestaurant(restaurantRepository.findById(restaurantId).orElseThrow());
        row.setWeekStart(ws);
        row.setStatus(status);
        row.setUpdatedBy(userRepository.findById(managerId).orElseThrow());
        row.setUpdatedAt(Instant.now());

        weekStatusRepository.save(row);
        return "OK";
    }

    // ===== MANAGER: weeks list by month =====
    @Transactional(readOnly = true)
    public List<WeekRowResponse> managerWeeks(Long restaurantId, YearMonth ym) {
        return staffWeeks(restaurantId, ym);
    }

    // ===== MANAGER: get one week with all staff =====
    @Transactional(readOnly = true)
    public ManagerWeekResponse managerWeek(Long restaurantId, LocalDate weekStart) {
        LocalDate ws = mondayOf(weekStart);
        LocalDate we = ws.plusDays(6);

        WeekStatusType status = getStatusOrDefault(restaurantId, ws);

        var staffList = userRepository.findByRestaurant_IdAndRoleOrderByFullNameAsc(
                restaurantId, com.shiftapp.users.UserRole.STAFF);

        List<Preference> allPrefs = preferenceRepository.findByRestaurant_IdAndWorkDateBetween(restaurantId, ws, we);

        Map<Long, Map<LocalDate, Preference>> byUser = new HashMap<>();
        for (Preference p : allPrefs) {
            byUser
                .computeIfAbsent(p.getUser().getId(), k -> new HashMap<>())
                .put(p.getWorkDate(), p);
        }

        List<ManagerStaffWeekRow> rows = new ArrayList<>();
        for (var user : staffList) {
            Map<LocalDate, Preference> map = byUser.getOrDefault(user.getId(), Collections.emptyMap());

            List<StaffWeekDay> days = new ArrayList<>();
            for (int i = 0; i < 7; i++) {
                LocalDate d = ws.plusDays(i);
                Preference p = map.get(d);

                StaffWeekDay day = new StaffWeekDay();
                day.setDate(d);
                if (p == null) {
                    day.setOff(false);
                    day.setStartTime(null);
                    day.setEndTime(null);
                } else if (p.getStartTime() == null && p.getEndTime() == null) {
                    day.setOff(true);
                    day.setStartTime(null);
                    day.setEndTime(null);
                } else {
                    day.setOff(false);
                    day.setStartTime(p.getStartTime());
                    day.setEndTime(p.getEndTime());
                }
                days.add(day);
            }

            ManagerStaffWeekRow row = new ManagerStaffWeekRow();
            row.setUserId(user.getId());
            row.setUserName(user.getFullName());
            row.setDays(days);
            rows.add(row);
        }

        ManagerWeekResponse res = new ManagerWeekResponse();
        res.setStatus(status);
        res.setRows(rows);
        return res;
    }

    // ===== MANAGER: save one staff week =====
    @Transactional
    public String managerSaveStaffWeek(Long restaurantId, Long managerId, ManagerWeekSaveRequest req) {
        LocalDate ws = mondayOf(req.getWeekStart());
        LocalDate we = ws.plusDays(6);

        var user = userRepository.findById(req.getUserId()).orElseThrow();
        if (!user.getRestaurant().getId().equals(restaurantId)) {
            throw new IllegalArgumentException("User belongs to another restaurant");
        }

        var restaurant = restaurantRepository.findById(restaurantId).orElseThrow();

        for (var d : req.getDays()) {
            if (d.getDate().isBefore(ws) || d.getDate().isAfter(we)) {
                throw new IllegalArgumentException("date out of week: " + d.getDate());
            }

            Preference p = preferenceRepository.findByUser_IdAndWorkDate(req.getUserId(), d.getDate())
                    .orElseGet(Preference::new);

            p.setUser(user);
            p.setRestaurant(restaurant);
            p.setWorkDate(d.getDate());

            if (d.isOff()) {
                p.setStartTime(null);
                p.setEndTime(null);
            } else {
                p.setStartTime(d.getStartTime());
                p.setEndTime(d.getEndTime());
            }
            preferenceRepository.save(p);
        }

        return "SAVED";
    }
}