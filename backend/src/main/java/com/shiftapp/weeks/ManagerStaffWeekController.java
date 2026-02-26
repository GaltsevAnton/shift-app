// package com.shiftapp.weeks;

// import com.shiftapp.common.CurrentUser;
// import com.shiftapp.employees.EmployeeRepository;
// import com.shiftapp.preferences.Preference;
// import com.shiftapp.preferences.PreferenceRepository;
// import com.shiftapp.weeks.dto.StaffWeekDay;
// import com.shiftapp.weeks.dto.StaffWeekResponse;
// import com.shiftapp.weeks.dto.StaffWeekSaveRequest;
// import org.springframework.web.bind.annotation.*;

// import java.time.LocalDate;
// import java.time.temporal.TemporalAdjusters;
// import java.util.*;

// @RestController
// @RequestMapping("/api/manager")
// public class ManagerStaffWeekController {

//     private final WeekStatusRepository weekStatusRepository;
//     private final PreferenceRepository preferenceRepository;
//     private final EmployeeRepository employeeRepository;

//     public ManagerStaffWeekController(
//             WeekStatusRepository weekStatusRepository,
//             PreferenceRepository preferenceRepository,
//             EmployeeRepository employeeRepository
//     ) {
//         this.weekStatusRepository = weekStatusRepository;
//         this.preferenceRepository = preferenceRepository;
//         this.employeeRepository = employeeRepository;
//     }

//     private static LocalDate mondayOf(LocalDate d) {
//         return d.with(TemporalAdjusters.previousOrSame(java.time.DayOfWeek.MONDAY));
//     }

//     private WeekStatusType getStatusOrDefault(Long restaurantId, LocalDate weekStart) {
//         return weekStatusRepository.findByRestaurant_IdAndWeekStart(restaurantId, weekStart)
//                 .map(WeekStatus::getStatus)
//                 .orElse(WeekStatusType.RECEIVING);
//     }

//     // менеджер смотрит неделю конкретного сотрудника
//     // ВНИМАНИЕ: параметр userId временно оставлен для совместимости, фактически это employeeId
//     @GetMapping("/staff-week")
//     public StaffWeekResponse getStaffWeek(@RequestParam Long userId, @RequestParam LocalDate weekStart) {
//         var me = CurrentUser.require(); // manager (User)
//         Long rid = me.getRestaurantId();

//         Long employeeId = userId;

//         var staff = employeeRepository.findById(employeeId).orElseThrow();
//         if (!staff.getRestaurant().getId().equals(rid)) {
//             throw new IllegalArgumentException("Employee belongs to another restaurant");
//         }

//         LocalDate ws = mondayOf(weekStart);
//         LocalDate we = ws.plusDays(6);

//         WeekStatusType status = getStatusOrDefault(rid, ws);

//         List<Preference> prefs = preferenceRepository.findByEmployee_IdAndWorkDateBetween(employeeId, ws, we);
//         Map<LocalDate, Preference> map = new HashMap<>();
//         for (Preference p : prefs) map.put(p.getWorkDate(), p);

//         List<StaffWeekDay> days = new ArrayList<>();
//         for (int i = 0; i < 7; i++) {
//             LocalDate d = ws.plusDays(i);
//             Preference p = map.get(d);

//             StaffWeekDay day = new StaffWeekDay();
//             day.setDate(d);

//             if (p == null) {
//                 day.setOff(false);
//                 day.setStartTime(null);
//                 day.setEndTime(null);
//             } else {
//                 if (p.getStartTime() == null || p.getEndTime() == null) {
//                     day.setOff(true);
//                     day.setStartTime(null);
//                     day.setEndTime(null);
//                 } else {
//                     day.setOff(false);
//                     day.setStartTime(p.getStartTime());
//                     day.setEndTime(p.getEndTime());
//                 }
//             }
//             days.add(day);
//         }

//         StaffWeekResponse res = new StaffWeekResponse();
//         res.setStatus(status);
//         res.setDays(days);
//         return res;
//     }

//     // менеджер сохраняет неделю сотрудника (запрещаем если CONFIRMED)
//     // ВНИМАНИЕ: userId = employeeId (временно)
//     @PostMapping("/staff-week/save")
//     public String saveStaffWeek(@RequestBody StaffWeekSaveRequest req, @RequestParam Long userId) {
//         var me = CurrentUser.require(); // manager (User)
//         Long rid = me.getRestaurantId();

//         Long employeeId = userId;

//         var staff = employeeRepository.findById(employeeId).orElseThrow();
//         if (!staff.getRestaurant().getId().equals(rid)) {
//             throw new IllegalArgumentException("Employee belongs to another restaurant");
//         }

//         LocalDate ws = mondayOf(req.getWeekStart());
//         WeekStatusType status = getStatusOrDefault(rid, ws);
//         if (status == WeekStatusType.CONFIRMED) {
//             throw new IllegalArgumentException("Week is locked (CONFIRMED)");
//         }

//         LocalDate we = ws.plusDays(6);

//         if (req.getDays() == null || req.getDays().size() != 7) {
//             throw new IllegalArgumentException("days must be 7 items");
//         }

//         for (var d : req.getDays()) {
//             if (d.getDate().isBefore(ws) || d.getDate().isAfter(we)) {
//                 throw new IllegalArgumentException("date out of week: " + d.getDate());
//             }

//             Preference p = preferenceRepository.findByEmployee_IdAndWorkDate(employeeId, d.getDate())
//                     .orElseGet(Preference::new);

//             p.setEmployee(staff);
//             p.setRestaurant(staff.getRestaurant());
//             p.setWorkDate(d.getDate());

//             if (d.isOff()) {
//                 p.setStartTime(null);
//                 p.setEndTime(null);
//             } else {
//                 p.setStartTime(d.getStartTime());
//                 p.setEndTime(d.getEndTime());
//             }
//             preferenceRepository.save(p);
//         }

//         return "SAVED";
//     }
// }
package com.shiftapp.weeks;

import com.shiftapp.common.CurrentUser;
import com.shiftapp.preferences.Preference;
import com.shiftapp.preferences.PreferenceRepository;
import com.shiftapp.users.UserRepository;
import com.shiftapp.weeks.dto.StaffWeekDay;
import com.shiftapp.weeks.dto.StaffWeekResponse;
import com.shiftapp.weeks.dto.StaffWeekSaveRequest;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.time.temporal.TemporalAdjusters;
import java.util.*;

@RestController
@RequestMapping("/api/manager")
public class ManagerStaffWeekController {

    private final WeekStatusRepository weekStatusRepository;
    private final PreferenceRepository preferenceRepository;
    private final UserRepository userRepository;

    public ManagerStaffWeekController(
            WeekStatusRepository weekStatusRepository,
            PreferenceRepository preferenceRepository,
            UserRepository userRepository
    ) {
        this.weekStatusRepository = weekStatusRepository;
        this.preferenceRepository = preferenceRepository;
        this.userRepository = userRepository;
    }

    private static LocalDate mondayOf(LocalDate d) {
        return d.with(TemporalAdjusters.previousOrSame(java.time.DayOfWeek.MONDAY));
    }

    private WeekStatusType getStatusOrDefault(Long restaurantId, LocalDate weekStart) {
        return weekStatusRepository.findByRestaurant_IdAndWeekStart(restaurantId, weekStart)
                .map(WeekStatus::getStatus)
                .orElse(WeekStatusType.RECEIVING);
    }

    @GetMapping("/staff-week")
    public StaffWeekResponse getStaffWeek(@RequestParam Long userId, @RequestParam LocalDate weekStart) {
        var me = CurrentUser.require();
        Long rid = me.getRestaurantId();

        var staff = userRepository.findById(userId).orElseThrow();
        if (!staff.getRestaurant().getId().equals(rid)) {
            throw new IllegalArgumentException("User belongs to another restaurant");
        }

        LocalDate ws = mondayOf(weekStart);
        LocalDate we = ws.plusDays(6);

        WeekStatusType status = getStatusOrDefault(rid, ws);

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

    @PostMapping("/staff-week/save")
    public String saveStaffWeek(@RequestBody StaffWeekSaveRequest req, @RequestParam Long userId) {
        var me = CurrentUser.require();
        Long rid = me.getRestaurantId();

        var staff = userRepository.findById(userId).orElseThrow();
        if (!staff.getRestaurant().getId().equals(rid)) {
            throw new IllegalArgumentException("User belongs to another restaurant");
        }

        LocalDate ws = mondayOf(req.getWeekStart());
        WeekStatusType status = getStatusOrDefault(rid, ws);
        if (status == WeekStatusType.CONFIRMED) {
            throw new IllegalArgumentException("Week is locked (CONFIRMED)");
        }

        LocalDate we = ws.plusDays(6);

        if (req.getDays() == null || req.getDays().size() != 7) {
            throw new IllegalArgumentException("days must be 7 items");
        }

        for (var d : req.getDays()) {
            if (d.getDate().isBefore(ws) || d.getDate().isAfter(we)) {
                throw new IllegalArgumentException("date out of week: " + d.getDate());
            }

            Preference p = preferenceRepository.findByUser_IdAndWorkDate(userId, d.getDate())
                    .orElseGet(Preference::new);

            p.setUser(staff);
            p.setRestaurant(staff.getRestaurant());
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