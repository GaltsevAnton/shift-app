package com.shiftapp.settings.breakrule;

import com.shiftapp.common.CurrentUser;
import com.shiftapp.restaurants.Restaurant;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/manager/settings/break-rules")
public class BreakRuleController {

    private final BreakRuleRepository repo;

    @PersistenceContext
    private EntityManager em;

    public BreakRuleController(BreakRuleRepository repo) {
        this.repo = repo;
    }

    @GetMapping
    public List<BreakRuleResponse> list() {
        Long restaurantId = CurrentUser.require().getRestaurantId();
        return repo.findByRestaurant_IdOrderByThresholdMinutesAsc(restaurantId)
                .stream().map(BreakRuleResponse::from).toList();
    }

    @PostMapping
    public BreakRuleResponse create(@RequestBody BreakRuleRequest req) {
        Long restaurantId = CurrentUser.require().getRestaurantId();
        BreakRule rule = new BreakRule();
        rule.setRestaurant(em.getReference(Restaurant.class, restaurantId));
        rule.setName(req.name);
        rule.setThresholdMinutes(req.thresholdMinutes);
        rule.setBreakMinutes(req.breakMinutes);
        return BreakRuleResponse.from(repo.save(rule));
    }

    @PutMapping("/{id}")
    public BreakRuleResponse update(@PathVariable Long id, @RequestBody BreakRuleRequest req) {
        Long restaurantId = CurrentUser.require().getRestaurantId();
        BreakRule rule = repo.findById(id)
                .filter(r -> r.getRestaurant().getId().equals(restaurantId))
                .orElseThrow(() -> new RuntimeException("Not found"));
        rule.setName(req.name);
        rule.setThresholdMinutes(req.thresholdMinutes);
        rule.setBreakMinutes(req.breakMinutes);
        return BreakRuleResponse.from(repo.save(rule));
    }

    @DeleteMapping("/{id}")
    public void delete(@PathVariable Long id) {
        Long restaurantId = CurrentUser.require().getRestaurantId();
        BreakRule rule = repo.findById(id)
                .filter(r -> r.getRestaurant().getId().equals(restaurantId))
                .orElseThrow(() -> new RuntimeException("Not found"));
        repo.delete(rule);
    }
}