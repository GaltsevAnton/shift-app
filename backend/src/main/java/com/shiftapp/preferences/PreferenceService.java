package com.shiftapp.preferences;

import com.shiftapp.preferences.dto.PreferenceResponse;
import com.shiftapp.preferences.dto.UpsertPreferenceRequest;
import com.shiftapp.users.User;
import com.shiftapp.users.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;

@Service
public class PreferenceService {

    private final PreferenceRepository preferenceRepository;
    private final UserRepository userRepository;

    public PreferenceService(PreferenceRepository preferenceRepository, UserRepository userRepository) {
        this.preferenceRepository = preferenceRepository;
        this.userRepository = userRepository;
    }

    @Transactional
    public PreferenceResponse upsertForUser(Long userId, UpsertPreferenceRequest req) {
        if (req.getStartTime() != null && req.getEndTime() != null) {
            if (!req.getEndTime().isAfter(req.getStartTime())) {
                throw new IllegalArgumentException("endTime must be after startTime");
            }
        }

        User user = userRepository.findById(userId).orElseThrow();

        Preference pref = preferenceRepository
                .findByUser_IdAndWorkDate(userId, req.getWorkDate())
                .orElseGet(Preference::new);

        pref.setUser(user);
        pref.setRestaurant(user.getRestaurant());
        pref.setWorkDate(req.getWorkDate());
        pref.setStartTime(req.getStartTime());
        pref.setEndTime(req.getEndTime());
        pref.setComment(req.getComment());

        if (pref.getStatus() == null) pref.setStatus(PreferenceStatus.DRAFT);

        Preference saved = preferenceRepository.save(pref);
        return toResponse(saved);
    }

    @Transactional(readOnly = true)
    public List<PreferenceResponse> listForUser(Long userId, LocalDate from, LocalDate to) {
        return preferenceRepository.findByUser_IdAndWorkDateBetween(userId, from, to)
                .stream().map(this::toResponse).toList();
    }

    @Transactional(readOnly = true)
    public List<PreferenceResponse> listForRestaurant(Long restaurantId, LocalDate from, LocalDate to) {
        return preferenceRepository.findByRestaurant_IdAndWorkDateBetween(restaurantId, from, to)
                .stream().map(this::toResponse).toList();
    }

    private PreferenceResponse toResponse(Preference p) {
        PreferenceResponse r = new PreferenceResponse();
        r.setId(p.getId());
        r.setUserId(p.getUser().getId());
        r.setUserName(p.getUser().getFullName());
        r.setWorkDate(p.getWorkDate());
        r.setStartTime(p.getStartTime());
        r.setEndTime(p.getEndTime());
        r.setStatus(p.getStatus());
        r.setComment(p.getComment());
        return r;
    }
}