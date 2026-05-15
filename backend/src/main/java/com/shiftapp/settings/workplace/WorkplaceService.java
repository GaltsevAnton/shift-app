package com.shiftapp.settings.workplace;

import com.shiftapp.restaurants.Restaurant;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
public class WorkplaceService {

    private final WorkplaceRepository repo;

    @PersistenceContext
    private EntityManager em;

    public WorkplaceService(WorkplaceRepository repo) {
        this.repo = repo;
    }

    public List<WorkplaceResponse> list(Long restaurantId) {
        return repo.findAllByRestaurant_IdOrderByIdAsc(restaurantId)
                .stream()
                .map(WorkplaceResponse::from)
                .toList();
    }

    @Transactional
    public WorkplaceResponse create(Long restaurantId, WorkplaceRequest req) {
        if (repo.existsByRestaurant_IdAndNameIgnoreCase(restaurantId, req.name.trim())) {
            throw new RuntimeException("同じ名前の勤務場所が既に存在します");
        }
        Workplace w = new Workplace();
        w.setRestaurant(em.getReference(Restaurant.class, restaurantId));
        w.setName(req.name.trim());
        repo.save(w);
        return WorkplaceResponse.from(w);
    }

    @Transactional
    public WorkplaceResponse update(Long restaurantId, Long id, WorkplaceRequest req) {
        Workplace w = repo.findById(id)
                .filter(x -> x.getRestaurant().getId().equals(restaurantId))
                .orElseThrow(() -> new RuntimeException("Not found"));
        w.setName(req.name.trim());
        return WorkplaceResponse.from(w);
    }

    @Transactional
    public void delete(Long restaurantId, Long id) {
        Workplace w = repo.findById(id)
                .filter(x -> x.getRestaurant().getId().equals(restaurantId))
                .orElseThrow(() -> new RuntimeException("Not found"));
        repo.delete(w);
    }
}