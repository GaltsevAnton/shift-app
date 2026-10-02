package com.shiftapp.attendance.note;

import com.shiftapp.restaurants.Restaurant;
import com.shiftapp.settings.attendancestatus.AttendanceStatus;
import com.shiftapp.settings.attendancestatus.AttendanceStatusRepository;
import com.shiftapp.users.User;
import com.shiftapp.users.UserRepository;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

@Service
public class AttendanceDayNoteService {

    private final AttendanceDayNoteRepository repo;
    private final AttendanceStatusRepository  statusRepo;
    private final UserRepository              userRepo;

    @PersistenceContext
    private EntityManager em;

    public AttendanceDayNoteService(AttendanceDayNoteRepository repo,
                                    AttendanceStatusRepository statusRepo,
                                    UserRepository userRepo) {
        this.repo       = repo;
        this.statusRepo = statusRepo;
        this.userRepo   = userRepo;
    }

    @Transactional(readOnly = true)
    public List<AttendanceDayNoteResponse> list(Long restaurantId, LocalDate from, LocalDate to) {
        return repo.findByRestaurant_IdAndWorkDateBetween(restaurantId, from, to)
                .stream()
                .map(AttendanceDayNoteResponse::from)
                .toList();
    }

    @Transactional
    public AttendanceDayNoteResponse set(Long restaurantId, Long actorUserId, AttendanceDayNoteRequest req) {
        if (req.getUserId() == null || req.getWorkDate() == null) {
            throw new IllegalArgumentException("userId と workDate は必須です");
        }

        User target = userRepo.findById(req.getUserId())
                .filter(u -> u.getRestaurant().getId().equals(restaurantId))
                .orElseThrow(() -> new IllegalArgumentException("User not found"));

        Optional<AttendanceDayNote> existing = repo.findByUser_IdAndWorkDate(target.getId(), req.getWorkDate());

        // statusId = null → пометку снимаем
        if (req.getStatusId() == null) {
            existing.ifPresent(repo::delete);
            return null;
        }

        AttendanceStatus status = statusRepo.findByIdAndRestaurant_Id(req.getStatusId(), restaurantId)
                .orElseThrow(() -> new IllegalArgumentException("勤務状況が見つかりません"));

        AttendanceDayNote note = existing.orElseGet(() -> {
            AttendanceDayNote n = new AttendanceDayNote();
            n.setRestaurant(em.getReference(Restaurant.class, restaurantId));
            n.setUser(target);
            n.setWorkDate(req.getWorkDate());
            return n;
        });
        note.setStatus(status);
        note.setLabel(status.getName());
        note.setUpdatedBy(em.getReference(User.class, actorUserId));
        note.setUpdatedAt(Instant.now());

        return AttendanceDayNoteResponse.from(repo.save(note));
    }
}