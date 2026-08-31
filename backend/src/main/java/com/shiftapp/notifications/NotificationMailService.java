package com.shiftapp.notifications;

import com.shiftapp.users.User;
import com.shiftapp.users.UserRepository;
import com.shiftapp.users.UserRole;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;

@Service
public class NotificationMailService {

    private final JavaMailSender mailSender;
    private final UserRepository userRepository;
    private final NotificationPreferenceRepository preferenceRepository;

    @Value("${spring.mail.username}")
    private String fromAddress;

    public NotificationMailService(JavaMailSender mailSender,
                                    UserRepository userRepository,
                                    NotificationPreferenceRepository preferenceRepository) {
        this.mailSender = mailSender;
        this.userRepository = userRepository;
        this.preferenceRepository = preferenceRepository;
    }

    // ── Публичные точки входа для каждого типа уведомления ─────────────────
    @Async
    public void notifyLateArrival(Long restaurantId, String userName, LocalDate date, LocalTime scheduled, LocalTime actual) {
        String subject = "【HannoSHIFT】遅刻通知 - " + userName;
        String body = String.format(
                "%s さんが出勤予定時刻に遅刻しました。%n%n" +
                "日付: %s%n" +
                "出勤予定: %s%n" +
                "実際の出勤: %s%n",
                userName, date, scheduled, actual);
        sendToSubscribedManagers(restaurantId, NotificationType.LATE_ARRIVAL, subject, body);
    }

    @Async
    public void notifyEarlyDeparture(Long restaurantId, String userName, LocalDate date, LocalTime scheduled, LocalTime actual) {
        String subject = "【HannoSHIFT】早退通知 - " + userName;
        String body = String.format(
                "%s さんが退勤予定時刻より早く退勤しました。%n%n" +
                "日付: %s%n" +
                "退勤予定: %s%n" +
                "実際の退勤: %s%n",
                userName, date, scheduled, actual);
        sendToSubscribedManagers(restaurantId, NotificationType.EARLY_DEPARTURE, subject, body);
    }

    @Async
    public void notifyUnscheduledArrival(Long restaurantId, String userName, LocalDate date, LocalTime actual) {
        String subject = "【HannoSHIFT】シフトなし出勤通知 - " + userName;
        String body = String.format(
                "%s さんがシフトの予定がない日に出勤の打刻をしました。%n%n" +
                "日付: %s%n" +
                "出勤時刻: %s%n" +
                "ご確認のうえ、必要に応じてシフトを設定してください。%n",
                userName, date, actual);
        sendToSubscribedManagers(restaurantId, NotificationType.UNSCHEDULED_ARRIVAL, subject, body);
    }

    @Async
    public void notifyAccountLocked(Long restaurantId, String userName) {
        String subject = "【HannoSHIFT】アカウントロック通知 - " + userName;
        String body = String.format(
                "%s さんのアカウントがログイン試行回数の上限に達し、永久ロックされました。%n%n" +
                "従業員管理画面からロックを解除できます。%n",
                userName);
        sendToSubscribedManagers(restaurantId, NotificationType.ACCOUNT_LOCKED, subject, body);
    }

    @Async
    public void notifyEmployeeCreated(Long restaurantId, String userName, String createdBy) {
        String subject = "【HannoSHIFT】新規従業員登録通知 - " + userName;
        String body = String.format(
                "新しい従業員が登録されました。%n%n" +
                "氏名: %s%n" +
                "登録者: %s%n",
                userName, createdBy);
        sendToSubscribedManagers(restaurantId, NotificationType.EMPLOYEE_CREATED, subject, body);
    }

    @Async
    public void notifyEmployeeDeleted(Long restaurantId, String userName, String deletedBy) {
        String subject = "【HannoSHIFT】従業員削除通知 - " + userName;
        String body = String.format(
                "従業員が削除されました。シフトデータと打刻記録もすべて削除されています。%n%n" +
                "氏名: %s%n" +
                "削除者: %s%n" +
                "この操作は取り消せません。%n",
                userName, deletedBy);
        sendToSubscribedManagers(restaurantId, NotificationType.EMPLOYEE_DELETED, subject, body);
    }
    
    @Async
    public void notifyPasswordChanged(Long restaurantId, String userName, String changedBy, Long excludeUserId) {
        String subject = "【HannoSHIFT】パスワード変更通知 - " + userName;
        String body = String.format(
                "%s さんのパスワードが変更されました。%n%n" +
                "変更者: %s%n" +
                "身に覚えがない場合は、至急ご本人にご確認ください。%n",
                userName, changedBy);
        sendToSubscribedManagers(restaurantId, NotificationType.PASSWORD_CHANGED, subject, body, excludeUserId);
    }

    private static <T> java.util.function.Predicate<T> distinctByKey(java.util.function.Function<T, ?> keyExtractor) {
        java.util.Set<Object> seen = java.util.concurrent.ConcurrentHashMap.newKeySet();
        return t -> seen.add(keyExtractor.apply(t));
    }

    @Async
    public void notifyForgotClockout(Long restaurantId, String userName, LocalDate date, LocalTime scheduledEnd) {
        String subject = "【HannoSHIFT】退勤忘れ通知 - " + userName;
        String body = String.format(
                "%s さんが退勤の打刻をせずにシフトが終了しています。%n%n" +
                "日付: %s%n" +
                "退勤予定: %s%n" +
                "ご確認のうえ、必要に応じて手動で打刻を修正してください。%n",
                userName, date, scheduledEnd);
        sendToSubscribedManagers(restaurantId, NotificationType.FORGOT_CLOCKOUT, subject, body);
    }

    // ── Общая логика рассылки: всем менеджерам ресторана, у кого включена настройка ──

    private void sendToSubscribedManagers(Long restaurantId, NotificationType type, String subject, String body) {
        sendToSubscribedManagers(restaurantId, type, subject, body, null);
    }

    private void sendToSubscribedManagers(Long restaurantId, NotificationType type, String subject, String body, Long excludeUserId) {
        List<User> managers = userRepository.findAllByRestaurant_IdOrderByIdDesc(restaurantId)
                .stream()
                .filter(u -> u.getRole() == UserRole.MANAGER && u.isActive() && u.getEmail() != null && !u.getEmail().isBlank())
                .filter(u -> excludeUserId == null || !u.getId().equals(excludeUserId))
                .filter(distinctByKey(User::getEmail)) // 同じメールアドレスへの重複送信を防止
                .toList();

        for (User manager : managers) {
            boolean enabled = preferenceRepository
                    .findByUser_IdAndNotificationType(manager.getId(), type)
                    .map(NotificationPreference::isEnabled)
                    .orElse(true); // opt-out: нет записи = включено по умолчанию

            if (!enabled) continue;

            try {
                SimpleMailMessage msg = new SimpleMailMessage();
                msg.setFrom(fromAddress);
                msg.setTo(manager.getEmail());
                msg.setSubject(subject);
                msg.setText(body);
                mailSender.send(msg);
            } catch (Exception e) {
                // Не даём падению одного письма прервать рассылку остальным
                System.err.println("通知メール送信失敗: " + manager.getEmail() + " - " + e.getMessage());
            }
        }
    }
}