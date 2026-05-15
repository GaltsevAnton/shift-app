package com.shiftapp.settings.position;

import com.shiftapp.restaurants.Restaurant;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
public class PositionService {

    private final PositionRepository repo;

    @PersistenceContext
    private EntityManager em;

    public PositionService(PositionRepository repo) {
        this.repo = repo;
    }

    public List<PositionResponse> list(Long restaurantId) {
        return repo.findAllByRestaurant_IdOrderByIdAsc(restaurantId)
                .stream()
                .map(PositionResponse::from)
                .toList();
    }

    @Transactional
    public PositionResponse create(Long restaurantId, PositionRequest req) {
        if (repo.existsByRestaurant_IdAndNameIgnoreCase(restaurantId, req.name.trim())) {
            throw new RuntimeException("同じ名前の職種が既に存在します");
        }
        Position p = new Position();
        p.setRestaurant(em.getReference(Restaurant.class, restaurantId));
        p.setName(req.name.trim());
        repo.save(p);
        return PositionResponse.from(p);
    }

    @Transactional
    public PositionResponse update(Long restaurantId, Long id, PositionRequest req) {
        Position p = repo.findById(id)
                .filter(x -> x.getRestaurant().getId().equals(restaurantId))
                .orElseThrow(() -> new RuntimeException("Not found"));
        p.setName(req.name.trim());
        return PositionResponse.from(p);
    }

    @Transactional
    public void delete(Long restaurantId, Long id) {
        Position p = repo.findById(id)
                .filter(x -> x.getRestaurant().getId().equals(restaurantId))
                .orElseThrow(() -> new RuntimeException("Not found"));
        repo.delete(p);
    }
}