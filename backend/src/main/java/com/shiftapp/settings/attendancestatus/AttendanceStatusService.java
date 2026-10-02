package com.shiftapp.settings.attendancestatus;

import com.shiftapp.restaurants.Restaurant;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
public class AttendanceStatusService {

    private final AttendanceStatusRepository repo;

    @PersistenceContext
    private EntityManager em;

    public AttendanceStatusService(AttendanceStatusRepository repo) {
        this.repo = repo;
    }

    public List<AttendanceStatusResponse> list(Long restaurantId) {
        return repo.findAllByRestaurant_IdOrderByIdAsc(restaurantId)
                .stream()
                .map(AttendanceStatusResponse::from)
                .toList();
    }

    @Transactional
    public AttendanceStatusResponse create(Long restaurantId, AttendanceStatusRequest req) {
        String name = req.name.trim();
        if (repo.existsByRestaurant_IdAndNameIgnoreCase(restaurantId, name)) {
            throw new RuntimeException("同じ名前の勤務状況が既に存在します");
        }
        AttendanceStatus s = new AttendanceStatus();
        s.setRestaurant(em.getReference(Restaurant.class, restaurantId));
        s.setName(name);
        repo.save(s);
        return AttendanceStatusResponse.from(s);
    }

    // Переименование НЕ трогает уже выставленные пометки — у них своя копия label
    @Transactional
    public AttendanceStatusResponse update(Long restaurantId, Long id, AttendanceStatusRequest req) {
        String name = req.name.trim();
        AttendanceStatus s = repo.findByIdAndRestaurant_Id(id, restaurantId)
                .orElseThrow(() -> new RuntimeException("Not found"));
        if (repo.existsByRestaurant_IdAndNameIgnoreCaseAndIdNot(restaurantId, name, id)) {
            throw new RuntimeException("同じ名前の勤務状況が既に存在します");
        }
        s.setName(name);
        return AttendanceStatusResponse.from(s);
    }

    // Удаление: в attendance_day_notes status_id → NULL (FK ON DELETE SET NULL), label остаётся
    @Transactional
    public void delete(Long restaurantId, Long id) {
        AttendanceStatus s = repo.findByIdAndRestaurant_Id(id, restaurantId)
                .orElseThrow(() -> new RuntimeException("Not found"));
        repo.delete(s);
    }
}