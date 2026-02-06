package com.shiftapp.shifts;

import com.shiftapp.shifts.dto.BulkShiftItem;
import com.shiftapp.shifts.dto.BulkShiftRequest;
import com.shiftapp.shifts.dto.ShiftResponse;
import com.shiftapp.users.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import com.shiftapp.shifts.dto.CopyWeekRequest;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

@Service
public class ShiftService {

    private final ShiftRepository shiftRepository;
    private final UserRepository userRepository;

    public ShiftService(ShiftRepository shiftRepository, UserRepository userRepository) {
        this.shiftRepository = shiftRepository;
        this.userRepository = userRepository;
    }

    @Transactional
    public void bulkUpsert(Long managerId, Long restaurantId, BulkShiftRequest req) {
        var manager = userRepository.findById(managerId).orElseThrow();

        for (BulkShiftItem item : req.getShifts()) {
            if (!item.getEndTime().isAfter(item.getStartTime())) {
                throw new IllegalArgumentException("endTime must be after startTime");
            }

            var user = userRepository.findById(item.getUserId())
                    .orElseThrow(() -> new IllegalArgumentException("User not found: " + item.getUserId()));

            if (!user.getRestaurant().getId().equals(restaurantId)) {
                throw new IllegalArgumentException("User belongs to another restaurant");
            }

            Shift shift = shiftRepository.findByUser_IdAndWorkDate(item.getUserId(), item.getWorkDate())
                    .orElseGet(Shift::new);

            shift.setRestaurant(user.getRestaurant());
            shift.setUser(user);
            shift.setWorkDate(item.getWorkDate());
            shift.setStartTime(item.getStartTime());
            shift.setEndTime(item.getEndTime());
            shift.setBreakMinutes(item.getBreakMinutes());
            shift.setStatus(ShiftStatus.PLANNED);
            shift.setCreatedBy(manager);
            shift.setUpdatedAt(Instant.now());

            shiftRepository.save(shift);
        }
    }

    @Transactional(readOnly = true)
    public List<ShiftResponse> list(Long restaurantId, LocalDate from, LocalDate to) {
        return shiftRepository.findByRestaurant_IdAndWorkDateBetween(restaurantId, from, to)
                .stream().map(this::toResponse).toList();
    }

    @Transactional
    public int copyWeek(Long managerId, Long restaurantId, CopyWeekRequest req) {
        LocalDate srcFrom = req.getFromWeekStart();
        LocalDate srcTo = srcFrom.plusDays(6);

        LocalDate dstFrom = req.getToWeekStart();
        LocalDate dstTo = dstFrom.plusDays(6);

        long deltaDays = java.time.temporal.ChronoUnit.DAYS.between(srcFrom, dstFrom);

        // overwrite: удалить все смены в целевой неделе ресторана
        if (req.isOverwrite()) {
            shiftRepository.deleteByRestaurantAndDateRange(restaurantId, dstFrom, dstTo);
        }

        var manager = userRepository.findById(managerId).orElseThrow();

        List<Shift> source = shiftRepository.findByRestaurant_IdAndWorkDateBetween(restaurantId, srcFrom, srcTo);

        int createdOrUpdated = 0;

        for (Shift s : source) {
            LocalDate newDate = s.getWorkDate().plusDays(deltaDays);

            // upsert по user + newDate
            Shift target = shiftRepository.findByUser_IdAndWorkDate(s.getUser().getId(), newDate)
                    .orElseGet(Shift::new);

            // если overwrite=false и смена уже была — пропускаем
            if (!req.isOverwrite() && target.getId() != null) {
                continue;
            }

            target.setRestaurant(s.getRestaurant());
            target.setUser(s.getUser());
            target.setWorkDate(newDate);
            target.setStartTime(s.getStartTime());
            target.setEndTime(s.getEndTime());
            target.setBreakMinutes(s.getBreakMinutes());
            target.setStatus(ShiftStatus.PLANNED);
            target.setCreatedBy(manager);
            target.setUpdatedAt(Instant.now());

            shiftRepository.save(target);
            createdOrUpdated++;
        }

        return createdOrUpdated;
    }

    private ShiftResponse toResponse(Shift s) {
        ShiftResponse r = new ShiftResponse();
        r.setId(s.getId());
        r.setUserId(s.getUser().getId());
        r.setUserName(s.getUser().getFullName());
        r.setWorkDate(s.getWorkDate());
        r.setStartTime(s.getStartTime());
        r.setEndTime(s.getEndTime());
        r.setBreakMinutes(s.getBreakMinutes());
        r.setStatus(s.getStatus());
        return r;
    }

    @Transactional
    public void deleteShift(Long restaurantId, Long shiftId) {
        Shift s = shiftRepository.findByIdAndRestaurant_Id(shiftId, restaurantId)
                .orElseThrow(() -> new IllegalArgumentException("Shift not found"));
        shiftRepository.delete(s);
    }

}
