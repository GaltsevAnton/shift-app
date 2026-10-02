package com.shiftapp.attendance.note;

import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface AttendanceDayNoteRepository extends JpaRepository<AttendanceDayNote, Long> {
    List<AttendanceDayNote> findByRestaurant_IdAndWorkDateBetween(Long restaurantId, LocalDate from, LocalDate to);
    Optional<AttendanceDayNote> findByUser_IdAndWorkDate(Long userId, LocalDate workDate);
}