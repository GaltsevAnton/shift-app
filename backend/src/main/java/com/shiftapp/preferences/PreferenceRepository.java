package com.shiftapp.preferences;

import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface PreferenceRepository extends JpaRepository<Preference, Long> {

    Optional<Preference> findByUser_IdAndWorkDate(Long userId, LocalDate workDate);

    List<Preference> findByUser_IdAndWorkDateBetween(Long userId, LocalDate from, LocalDate to);

    List<Preference> findByRestaurant_IdAndWorkDateBetween(Long restaurantId, LocalDate from, LocalDate to);
}