package com.shiftapp.months;

import com.shiftapp.common.CurrentUser;
import com.shiftapp.preferences.Preference;
import com.shiftapp.preferences.PreferenceRepository;
import com.shiftapp.preferences.ShiftSlot;
import com.shiftapp.restaurants.Restaurant;
import com.shiftapp.users.UserRepository;
import com.shiftapp.weeks.WeekService;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.time.*;
import java.util.*;

@RestController
@RequestMapping("/api/staff/month")
public class StaffMonthController {

    private final MonthStatusRepository  monthStatusRepo;
    private final PreferenceRepository   preferenceRepo;
    private final UserRepository         userRepository;

    @PersistenceContext
    private EntityManager em;

    public StaffMonthController(MonthStatusRepository monthStatusRepo,
                                PreferenceRepository preferenceRepo,
                                UserRepository userRepository) {
        this.monthStatusRepo = monthStatusRepo;
        this.preferenceRepo  = preferenceRepo;
        this.userRepository  = userRepository;
    }

    /* ── GET /api/staff/month?month=YYYY-MM ── */
    @GetMapping
    public Map<String, Object> getMonth(@RequestParam String month) {
        var me = CurrentUser.require();
        Long restaurantId = me.getRestaurantId();
        Long userId       = me.getUserId();

        YearMonth ym = YearMonth.parse(month);
        LocalDate from = ym.atDay(1);
        LocalDate to   = ym.atEndOfMonth();

        List<Preference> prefs = preferenceRepo
                .findByUser_IdAndWorkDateBetweenWithSlots(userId, from, to);
        Map<LocalDate, Preference> prefMap = new HashMap<>();
        for (Preference p : prefs) prefMap.put(p.getWorkDate(), p);

        List<Map<String, Object>> days = new ArrayList<>();
        for (LocalDate d = from; !d.isAfter(to); d = d.plusDays(1)) {
            Preference p = prefMap.get(d);
            Map<String, Object> day = new HashMap<>();
            day.put("date", d.toString());
            if (p == null || p.isOff() || p.getSlots().isEmpty()) {
                day.put("off", true);
                day.put("startTime", null);
                day.put("endTime", null);
            } else {
                day.put("off", false);
                LocalTime start = p.getSlots().stream()
                        .map(ShiftSlot::getStartTime)
                        .filter(Objects::nonNull)
                        .min(Comparator.naturalOrder()).orElse(null);
                LocalTime end = p.getSlots().stream()
                        .map(ShiftSlot::getEndTime)
                        .filter(Objects::nonNull)
                        .max(Comparator.naturalOrder()).orElse(null);
                day.put("startTime", start != null ? start.toString().substring(0, 5) : null);
                boolean anyLast = p.getSlots().stream().anyMatch(ShiftSlot::isLast);
                day.put("last", anyLast);
                day.put("endTime", anyLast ? null : (end != null ? end.toString().substring(0, 5) : null));
            }
            days.add(day);
        }
        
        String status1 = monthStatusRepo
                .findByRestaurant_IdAndYearMonthAndHalf(restaurantId, month, 1)
                .map(MonthStatus::getStatus).orElse("RECEIVING");
        String status2 = monthStatusRepo
                .findByRestaurant_IdAndYearMonthAndHalf(restaurantId, month, 2)
                .map(MonthStatus::getStatus).orElse("RECEIVING");

        return Map.of("status1", status1, "status2", status2, "days", days);
    }

    /* ── POST /api/staff/month/save ── */
    @PostMapping("/save")
    @Transactional
    public Map<String, String> saveMonth(@RequestBody SaveMonthRequest req) {
        var me = CurrentUser.require();
        Long restaurantId = me.getRestaurantId();
        Long userId       = me.getUserId();

        YearMonth ym = YearMonth.parse(req.getMonth());

        // Проверяем стату
        var user       = userRepository.findById(userId).orElseThrow();
        var restaurant = em.getReference(Restaurant.class, restaurantId);

        String status1 = monthStatusRepo
                .findByRestaurant_IdAndYearMonthAndHalf(restaurantId, req.getMonth(), 1)
                .map(MonthStatus::getStatus).orElse("RECEIVING");
        String status2 = monthStatusRepo
                .findByRestaurant_IdAndYearMonthAndHalf(restaurantId, req.getMonth(), 2)
                .map(MonthStatus::getStatus).orElse("RECEIVING");

        for (var d : req.getDays()) {
            LocalDate date = LocalDate.parse(d.getDate());
            int half = date.getDayOfMonth() <= 15 ? 1 : 2;
            String status = half == 1 ? status1 : status2;
            if (!"RECEIVING".equals(status)) continue;
            Preference p = preferenceRepo.findByUser_IdAndWorkDate(userId, date)
                    .orElseGet(Preference::new);
            p.setUser(user);
            p.setRestaurant(restaurant);
            p.setWorkDate(date);

            if (d.isOff() || d.getStartTime() == null || d.getEndTime() == null) {
                p.setOff(true);
                p.getSlots().clear();
            } else {
                p.setOff(false);
                p.getSlots().clear();
                ShiftSlot slot = new ShiftSlot();
                slot.setPreference(p);
                slot.setSlotOrder(0);
                slot.setStartTime(LocalTime.parse(d.getStartTime()));
                slot.setEndTime(LocalTime.parse(d.getEndTime()));
                slot.setLast(false);
                slot.setWorkplace(null);
                p.getSlots().add(slot);
            }
            preferenceRepo.save(p);
        }
        return Map.of("result", "SAVED");
    }


}