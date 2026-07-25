package com.shiftapp.months;

import com.shiftapp.common.CurrentUser;
import com.shiftapp.restaurants.Restaurant;
import com.shiftapp.users.UserRepository;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.util.Map;

@RestController
@RequestMapping("/api/manager/month-status")
public class MonthStatusController {

    private final MonthStatusRepository repo;
    private final UserRepository userRepository;

    @PersistenceContext
    private EntityManager em;

    public MonthStatusController(MonthStatusRepository repo, UserRepository userRepository) {
        this.repo = repo;
        this.userRepository = userRepository;
    }

    @GetMapping
    public Map<String, Object> getStatus(@RequestParam String month) {
        Long restaurantId = CurrentUser.require().getRestaurantId();
        String status1 = repo.findByRestaurant_IdAndYearMonthAndHalf(restaurantId, month, 1)
                .map(MonthStatus::getStatus).orElse("RECEIVING");
        String status2 = repo.findByRestaurant_IdAndYearMonthAndHalf(restaurantId, month, 2)
                .map(MonthStatus::getStatus).orElse("RECEIVING");
        return Map.of("status1", status1, "status2", status2);
    }
    
    @PostMapping
    public Map<String, String> setStatus(
            @RequestParam String month,
            @RequestParam String status,
            @RequestParam(defaultValue = "1") int half) {
        Long restaurantId = CurrentUser.require().getRestaurantId();
        Long userId = CurrentUser.require().getUserId();
    
        MonthStatus ms = repo.findByRestaurant_IdAndYearMonthAndHalf(restaurantId, month, half)
                .orElseGet(MonthStatus::new);
    
        ms.setRestaurant(em.getReference(Restaurant.class, restaurantId));
        ms.setYearMonth(month);
        ms.setHalf(half);
        ms.setStatus(status);
        ms.setUpdatedBy(userRepository.findById(userId).orElseThrow());
        ms.setUpdatedAt(Instant.now());
    
        repo.save(ms);
        return Map.of("status", status);
    }
}