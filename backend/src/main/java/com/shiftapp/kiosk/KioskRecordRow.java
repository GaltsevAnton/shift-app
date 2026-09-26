package com.shiftapp.kiosk;

import java.time.Instant;
import java.time.LocalDate;

/**
 * Лёгкая строка записи отметки — только поля, нужные для статуса на киоске.
 * Читается из БД напрямую (без загрузки связанных User / Restaurant),
 * см. TimeRecordRepository.findRowsSince / findRowsByUserIdsAndWorkDate.
 */
public record KioskRecordRow(
        Long userId,
        TimeRecordType recordType,
        Instant recordedAt,
        LocalDate workDate,
        String photoPath
) {}