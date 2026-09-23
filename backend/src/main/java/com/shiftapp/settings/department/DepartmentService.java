package com.shiftapp.settings.department;

import com.shiftapp.restaurants.Restaurant;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
public class DepartmentService {

    private final DepartmentRepository repo;

    @PersistenceContext
    private EntityManager em;

    public DepartmentService(DepartmentRepository repo) {
        this.repo = repo;
    }

    public List<DepartmentResponse> list(Long restaurantId) {
        return repo.findAllByRestaurant_IdOrderBySortOrderAsc(restaurantId)
                .stream()
                .map(DepartmentResponse::from)
                .toList();
    }

    @Transactional
    public DepartmentResponse create(Long restaurantId, DepartmentRequest req) {
        if (repo.existsByRestaurant_IdAndNameIgnoreCase(restaurantId, req.name.trim())) {
            throw new RuntimeException("同じ名前の部署が既に存在します");
        }
        Department d = new Department();
        d.setRestaurant(em.getReference(Restaurant.class, restaurantId));
        d.setName(req.name.trim());
        d.setSortOrder(repo.countByRestaurant_Id(restaurantId));
        repo.save(d);
        return DepartmentResponse.from(d);
    }

    @Transactional
    public DepartmentResponse update(Long restaurantId, Long id, DepartmentRequest req) {
        Department d = repo.findById(id)
                .filter(x -> x.getRestaurant().getId().equals(restaurantId))
                .orElseThrow(() -> new RuntimeException("Not found"));
        d.setName(req.name.trim());
        return DepartmentResponse.from(d);
    }

    @Transactional
    public void delete(Long restaurantId, Long id) {
        Department d = repo.findById(id)
                .filter(x -> x.getRestaurant().getId().equals(restaurantId))
                .orElseThrow(() -> new RuntimeException("Not found"));
        repo.delete(d);
    }

    @Transactional
    public void reorder(Long restaurantId, List<Long> orderedIds) {
        List<Department> all = repo.findAllByRestaurant_IdOrderBySortOrderAsc(restaurantId);
        java.util.Map<Long, Department> byId = new java.util.HashMap<>();
        for (Department d : all) byId.put(d.getId(), d);

        for (int i = 0; i < orderedIds.size(); i++) {
            Department d = byId.get(orderedIds.get(i));
            if (d == null) {
                throw new RuntimeException("Invalid department id: " + orderedIds.get(i));
            }
            d.setSortOrder(i);
        }
    }
}