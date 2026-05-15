package com.shiftapp.preferences;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

import java.util.List;

public interface ShiftSlotRepository extends JpaRepository<ShiftSlot, Long> {

    List<ShiftSlot> findByPreference_IdOrderBySlotOrderAsc(Long preferenceId);

    @Modifying
    @Query("DELETE FROM ShiftSlot s WHERE s.preference.id = :prefId")
    void deleteByPreferenceId(Long prefId);

    @Modifying
    @Query("DELETE FROM ShiftSlot s WHERE s.preference.id IN :prefIds")
    void deleteByPreferenceIdIn(List<Long> prefIds);
}