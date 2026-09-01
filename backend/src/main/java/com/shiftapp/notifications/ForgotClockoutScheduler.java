package com.shiftapp.notifications;

import com.shiftapp.kiosk.TimeRecord;
import com.shiftapp.kiosk.TimeRecordRepository;
import com.shiftapp.preferences.Preference;
import com.shiftapp.preferences.PreferenceRepository;
import com.shiftapp.preferences.ShiftSlot;
import com.shiftapp.restaurants.Restaurant;
import com.shiftapp.restaurants.RestaurantRepository;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.Trigger;
import org.springframework.scheduling.TriggerContext;
import org.springframework.scheduling.annotation.SchedulingConfigurer;
import org.springframework.scheduling.config.ScheduledTaskRegistrar;
import org.springframework.scheduling.support.CronTrigger;

import java.time.*;
import java.util.Comparator;
import java.util.List;
import java.util.Date;
import java.util.TimeZone;

@Configuration
public class ForgotClockoutScheduler implements SchedulingConfigurer {

    private final NotificationSettingsRepository settingsRepository;
    private final RestaurantRepository restaurantRepository;
    private final TimeRecordRepository timeRecordRepository;
    private final PreferenceRepository preferenceRepository;
    private final NotificationMailService mailService;

    private static final ZoneId ZONE = ZoneId.of("Asia/Tokyo");

    public ForgotClockoutScheduler(NotificationSettingsRepository settingsRepository,
                                    RestaurantRepository restaurantRepository,
                                    TimeRecordRepository timeRecordRepository,
                                    PreferenceRepository preferenceRepository,
                                    NotificationMailService mailService) {
        this.settingsRepository = settingsRepository;
        this.restaurantRepository = restaurantRepository;
        this.timeRecordRepository = timeRecordRepository;
        this.preferenceRepository = preferenceRepository;
        this.mailService = mailService;
    }

    @Override
    public void configureTasks(ScheduledTaskRegistrar taskRegistrar) {
        taskRegistrar.addTriggerTask(this::runCheck, this::nextExecutionTime);
    }

    // Время следующего запуска пересчитывается КАЖДЫЙ РАЗ заново из БД —
    // изменение настройки в UI подхватывается без рестарта сервера
    private Instant nextExecutionTime(TriggerContext triggerContext) {
        LocalTime checkTime = getGlobalCheckTime();
        Trigger trigger = new CronTrigger(cronFor(checkTime), TimeZone.getTimeZone(ZONE));
        Date next = trigger.nextExecutionTime(triggerContext);
        return next != null ? next.toInstant() : null;
    }

    // Пока у нас один ресторан — берём его настройку. Если появятся мульти-рестораны,
    // здесь нужно будет усложнить (например, минимальное время среди всех ресторанов).
    private LocalTime getGlobalCheckTime() {
        return settingsRepository.findAll().stream()
                .findFirst()
                .map(NotificationSettings::getForgotClockoutCheckTime)
                .orElse(LocalTime.MIDNIGHT);
    }

    private String cronFor(LocalTime t) {
        return String.format("0 %d %d * * *", t.getMinute(), t.getHour());
    }

    private void runCheck() {
        for (Restaurant restaurant : restaurantRepository.findAll()) {
            checkRestaurant(restaurant);
        }
    }

    private void checkRestaurant(Restaurant restaurant) {
        LocalDate today = LocalDate.now(ZONE);
        LocalDate twoDaysAgo = today.minusDays(2);
        Instant now = Instant.now();

        // チェック時刻が何時に設定されていても対応できるよう、直近2日分の記録から
        // まだ閉じられていないセッションを探す（日付境界のズレを吸収するため）
        List<TimeRecord> records = timeRecordRepository.findByRestaurantAndDateRange(restaurant.getId(), twoDaysAgo, today);

        records.stream()
                .collect(java.util.stream.Collectors.groupingBy(r -> r.getUser().getId()))
                .forEach((userId, userRecords) -> {
                    userRecords.sort(Comparator.comparing(TimeRecord::getRecordedAt));
                    TimeRecord openClockIn = findUnclosedClockIn(userRecords);
                    if (openClockIn == null) return;

                    LocalDate workDate = openClockIn.getWorkDate();

                    Preference pref = preferenceRepository
                            .findByRestaurant_IdAndWorkDateBetweenWithSlots(restaurant.getId(), workDate, workDate)
                            .stream()
                            .filter(p -> p.getUser().getId().equals(userId))
                            .findFirst()
                            .orElse(null);

                    if (pref == null || pref.isOff() || pref.getSlots().isEmpty()) return;

                    ShiftSlot slot = pref.getSlots().stream()
                            .filter(sl -> sl.getEndTime() != null)
                            .max(Comparator.comparing(ShiftSlot::getEndTime))
                            .orElse(null);
                    if (slot == null) return;

                    // ナイトシフト（翌日にまたがる）は対象外
                    boolean nextDay = slot.isNextDay() ||
                            (slot.getStartTime() != null && !slot.getEndTime().isAfter(slot.getStartTime()));
                    if (nextDay) return;

                    // 予定終了時刻をまだ過ぎていない場合は対象外（同日チェックの場合に必要）
                    Instant plannedEnd = workDate.atTime(slot.getEndTime()).atZone(ZONE).toInstant();
                    if (now.isBefore(plannedEnd)) return;

                    mailService.notifyForgotClockout(
                            restaurant.getId(),
                            openClockIn.getUser().getFullName(),
                            workDate,
                            slot.getEndTime()
                    );
                });
    }

    private TimeRecord findUnclosedClockIn(List<TimeRecord> sorted) {
        TimeRecord current = null;
        for (TimeRecord r : sorted) {
            switch (r.getRecordType()) {
                case CLOCK_IN  -> current = r;
                case CLOCK_OUT -> current = null;
                default -> { /* BREAK_START/END не влияют */ }
            }
        }
        return current;
    }
}