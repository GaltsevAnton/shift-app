package com.shiftapp.weeks;

import com.shiftapp.preferences.Preference;
import com.shiftapp.preferences.PreferenceRepository;
import com.shiftapp.preferences.ShiftSlot;
import com.shiftapp.preferences.ShiftSlotRepository;
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

    private final WeekStatusRepository    weekStatusRepository;
    private final RestaurantRepository    restaurantRepository;
    private final UserRepository          userRepository;
    private final PreferenceRepository    preferenceRepository;
    private final ShiftSlotRepository     slotRepository;

    public WeekService(WeekStatusRepository weekStatusRepository,
                       RestaurantRepository restaurantRepository,
                       UserRepository userRepository,
                       PreferenceRepository preferenceRepository,
                       ShiftSlotRepository slotRepository) {
        this.weekStatusRepository = weekStatusRepository;
        this.restaurantRepository = restaurantRepository;
        this.userRepository       = userRepository;
        this.preferenceRepository = preferenceRepository;
        this.slotRepository       = slotRepository;
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

    /**
     * Строит StaffWeekDay для сотрудника:
     * - flat поля: earliest startTime, latest endTime (или last=true если хоть один слот last)
     * - slots: null (сотрудник не видит детализацию)
     */
    private StaffWeekDay buildDayForStaff(LocalDate date, Preference p) {
        StaffWeekDay day = new StaffWeekDay();
        day.setDate(date);

        if (p == null || p.isOff() || p.getSlots().isEmpty()) {
            boolean isOff = (p != null && p.isOff()) ||
                            (p != null && p.getSlots().isEmpty());
            day.setOff(isOff || p == null);
            day.setStartTime(null);
            day.setEndTime(null);
            day.setLast(false);
            return day;
        }

        List<ShiftSlot> slots = p.getSlots();
        day.setOff(false);

        // Earliest start
        LocalTime earliest = slots.stream()
                .map(ShiftSlot::getStartTime)
                .filter(Objects::nonNull)
                .min(Comparator.naturalOrder())
                .orElse(null);
        day.setStartTime(earliest);

        // Any slot has last=true?
        boolean anyLast = slots.stream().anyMatch(ShiftSlot::isLast);
        day.setLast(anyLast);

        if (anyLast) {
            day.setEndTime(null);
        } else {
            // Latest end
            LocalTime latest = slots.stream()
                    .map(ShiftSlot::getEndTime)
                    .filter(Objects::nonNull)
                    .max(Comparator.naturalOrder())
                    .orElse(null);
            day.setEndTime(latest);
        }

        return day;
    }

    /**
     * Строит StaffWeekDay для менеджера:
     * - flat поля (для совместимости)
     * - slots: полный список слотов
     */
    private StaffWeekDay buildDayForManager(LocalDate date, Preference p) {
        StaffWeekDay day = buildDayForStaff(date, p);

        if (p == null || p.isOff() || p.getSlots().isEmpty()) {
            day.setSlots(Collections.emptyList());
            return day;
        }

        List<SlotDto> slotDtos = new ArrayList<>();
        for (ShiftSlot s : p.getSlots()) {
            slotDtos.add(new SlotDto(
                s.getStartTime(),
                s.getEndTime(),
                s.isLast(),
                s.getWorkplace(),
                s.isNextDay()
            ));
        }
        day.setSlots(slotDtos);
        return day;
    }

    // ===== STAFF: weeks list by month =====
    @Transactional(readOnly = true)
    public List<WeekRowResponse> staffWeeks(Long restaurantId, YearMonth ym) {
        LocalDate monthStart    = ym.atDay(1);
        LocalDate monthEnd      = ym.atEndOfMonth();
        LocalDate firstWeekStart = mondayOf(monthStart);
        LocalDate lastWeekStart  = mondayOf(monthEnd);

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
        if (!user.getRestaurant().getId().equals(restaurantId))
            throw new IllegalArgumentException("User belongs to another restaurant");

        WeekStatusType status = getStatusOrDefault(restaurantId, ws);

        List<Preference> prefs = preferenceRepository.findByUser_IdAndWorkDateBetweenWithSlots(userId, ws, we);
        Map<LocalDate, Preference> map = new HashMap<>();
        for (Preference p : prefs) map.put(p.getWorkDate(), p);

        List<StaffWeekDay> days = new ArrayList<>();
        for (int i = 0; i < 7; i++) {
            LocalDate d = ws.plusDays(i);
            days.add(buildDayForStaff(d, map.get(d)));
        }

        StaffWeekResponse res = new StaffWeekResponse();
        res.setStatus(status);
        res.setDays(days);
        return res;
    }

    // ===== STAFF: save week (flat — один слот на день) =====
    @Transactional
    public String staffSaveWeek(Long restaurantId, Long userId, StaffWeekSaveRequest req) {
        LocalDate ws = mondayOf(req.getWeekStart());
        WeekStatusType status = getStatusOrDefault(restaurantId, ws);
        if (status != WeekStatusType.RECEIVING)
            throw new IllegalArgumentException("Week is locked (status=" + status + ")");

        LocalDate we = ws.plusDays(6);
        if (req.getDays() == null || req.getDays().size() != 7)
            throw new IllegalArgumentException("days must be 7 items");

        var user       = userRepository.findById(userId).orElseThrow();
        if (!user.getRestaurant().getId().equals(restaurantId))
            throw new IllegalArgumentException("User belongs to another restaurant");

        var restaurant = restaurantRepository.findById(restaurantId).orElseThrow();

        for (var d : req.getDays()) {
            if (d.getDate().isBefore(ws) || d.getDate().isAfter(we))
                throw new IllegalArgumentException("date out of week: " + d.getDate());

            if (!d.isOff()) {
                // если оба времени пустые — считаем выходным
                if (d.getStartTime() == null && d.getEndTime() == null) {
                    d.setOff(true);
                } else {
                    if (d.getStartTime() == null || d.getEndTime() == null)
                        throw new IllegalArgumentException("開始・終了時間を両方入力してください");
                    int dur = calcDuration(d.getStartTime(), d.getEndTime());
                    if (dur < 30)      throw new IllegalArgumentException("勤務時間が短すぎます（30分以上）");
                    if (dur > 16 * 60) throw new IllegalArgumentException("勤務時間が長すぎます（最大16時間）");
                }
            }
            
            Preference p = preferenceRepository.findByUser_IdAndWorkDate(userId, d.getDate())
                    .orElseGet(Preference::new);

            p.setUser(user);
            p.setRestaurant(restaurant);
            p.setWorkDate(d.getDate());

            if (d.isOff()) {
                p.setOff(true);
                p.getSlots().clear();
            } else {
                p.setOff(false);
                p.getSlots().clear();

                ShiftSlot slot = new ShiftSlot();
                slot.setPreference(p);
                slot.setSlotOrder(0);
                slot.setStartTime(d.getStartTime());
                slot.setLast(false); // сотрудник не может выставить Last
                slot.setEndTime(d.getEndTime());
                slot.setWorkplace(null);
                p.getSlots().add(slot);
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
        if (status != WeekStatusType.RECEIVING)
            throw new IllegalArgumentException("Week is locked (status=" + status + ")");

        var user = userRepository.findById(userId).orElseThrow();
        if (!user.getRestaurant().getId().equals(restaurantId))
            throw new IllegalArgumentException("User belongs to another restaurant");

        LocalDate srcWs = dstWs.minusWeeks(1);
        LocalDate srcWe = srcWs.plusDays(6);

        List<Preference> src = preferenceRepository.findByUser_IdAndWorkDateBetweenWithSlots(userId, srcWs, srcWe);
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
            to.getSlots().clear();
            
            if (from.isOff()) {
                to.setOff(true);
            } else {
                to.setOff(false);
            
                boolean hasLast = from.getSlots().stream().anyMatch(ShiftSlot::isLast);
            
                if (hasLast) {
                    // если был L — берём только earliest startTime, один слот без endTime
                    LocalTime earliestStart = from.getSlots().stream()
                            .map(ShiftSlot::getStartTime)
                            .filter(Objects::nonNull)
                            .min(Comparator.naturalOrder())
                            .orElse(null);
            
                    ShiftSlot copy = new ShiftSlot();
                    copy.setPreference(to);
                    copy.setSlotOrder(0);
                    copy.setStartTime(earliestStart);
                    copy.setEndTime(null);
                    copy.setLast(false);
                    copy.setWorkplace(null);
                    to.getSlots().add(copy);
                } else {
                    // без L — копируем все слоты как есть
                    int order = 0;
                    for (ShiftSlot s : from.getSlots()) {
                        ShiftSlot copy = new ShiftSlot();
                        copy.setPreference(to);
                        copy.setSlotOrder(order++);
                        copy.setStartTime(s.getStartTime());
                        copy.setEndTime(s.getEndTime());
                        copy.setLast(false);
                        copy.setWorkplace(s.getWorkplace());
                        to.getSlots().add(copy);
                    }
                }
            }
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

        var staffList = userRepository.findByRestaurant_IdAndRoleInOrderByFullNameAsc(
            restaurantId, List.of(com.shiftapp.users.UserRole.STAFF, com.shiftapp.users.UserRole.MANAGER));

        List<Preference> allPrefs =
                preferenceRepository.findByRestaurant_IdAndWorkDateBetweenWithSlots(restaurantId, ws, we);

        Map<Long, Map<LocalDate, Preference>> byUser = new HashMap<>();
        for (Preference p : allPrefs) {
            byUser.computeIfAbsent(p.getUser().getId(), k -> new HashMap<>())
                  .put(p.getWorkDate(), p);
        }

        List<ManagerStaffWeekRow> rows = new ArrayList<>();
        for (var user : staffList) {
            Map<LocalDate, Preference> map = byUser.getOrDefault(user.getId(), Collections.emptyMap());

            List<StaffWeekDay> days = new ArrayList<>();
            for (int i = 0; i < 7; i++) {
                LocalDate d = ws.plusDays(i);
                days.add(buildDayForManager(d, map.get(d)));
            }

            ManagerStaffWeekRow row = new ManagerStaffWeekRow();
            row.setUserId(user.getId());
            row.setUserName(user.getFullName());
            row.setDays(days);
            rows.add(row);
        }

        ManagerWeekResponse res = new ManagerWeekResponse();
        res.setWeekStart(ws);
        res.setWeekEnd(we);
        res.setStatus(status);
        res.setRows(rows);
        return res;
    }

    // ===== MANAGER: save one staff week (with slots) =====
    @Transactional
    public String managerSaveStaffWeek(Long restaurantId, Long userId, ManagerStaffWeekSaveRequest req) {
        LocalDate ws = mondayOf(req.getWeekStart());
        LocalDate we = ws.plusDays(6);

        var user = userRepository.findById(userId).orElseThrow();
        if (!user.getRestaurant().getId().equals(restaurantId))
            throw new IllegalArgumentException("User belongs to another restaurant");

        var restaurant = restaurantRepository.findById(restaurantId).orElseThrow();

        for (var d : req.getDays()) {
            if (d.getDate().isBefore(ws) || d.getDate().isAfter(we))
                throw new IllegalArgumentException("date out of week: " + d.getDate());

            Preference p = preferenceRepository.findByUser_IdAndWorkDate(userId, d.getDate())
                    .orElseGet(Preference::new);

            p.setUser(user);
            p.setRestaurant(restaurant);
            p.setWorkDate(d.getDate());

            boolean hasSlots = d.getSlots() != null && !d.getSlots().isEmpty();

            if (d.isOff() || !hasSlots) {
                p.setOff(true);
                p.getSlots().clear();
            } else {
                p.setOff(false);
                p.getSlots().clear();

                int order = 0;
                for (var si : d.getSlots()) {
                    ShiftSlot slot = new ShiftSlot();
                    slot.setPreference(p);
                    slot.setSlotOrder(order++);
                    slot.setStartTime(si.getStartTime());
                    slot.setLast(si.isLast());
                    slot.setEndTime(si.getEndTime());
                    slot.setWorkplace(si.getWorkplace());
                    slot.setNextDay(si.isLast() ? false : si.isNextDay());
                    p.getSlots().add(slot);
                }
            }
            preferenceRepository.save(p);
        }
        return "SAVED";
    }

    // ===== private helpers =====

    private int calcDuration(LocalTime start, LocalTime end) {
        int s = start.getHour() * 60 + start.getMinute();
        int e = end.getHour()   * 60 + end.getMinute();
        if (e <= s) e += 24 * 60;
        return e - s;
    }
}