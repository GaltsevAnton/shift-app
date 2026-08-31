package com.shiftapp.auth;

import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.shiftapp.auth.dto.LoginRequest;
import com.shiftapp.auth.dto.LoginResponse;
import com.shiftapp.auth.security.CustomUserDetails;
import com.shiftapp.notifications.NotificationMailService;

import jakarta.validation.Valid;
import java.time.Instant;

@RestController
@RequestMapping("/api/auth")
public class AuthController {
    private final com.shiftapp.users.UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;
    private final NotificationMailService notificationMailService;

    public AuthController(com.shiftapp.users.UserRepository userRepository,
                          PasswordEncoder passwordEncoder,
                          JwtService jwtService,
                          NotificationMailService notificationMailService) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtService = jwtService;
        this.notificationMailService = notificationMailService;
    }

    private static final int[] LOCK_THRESHOLDS = { 5, 10, 15, 20 };
    private static final long[] LOCK_MINUTES   = { 10, 30, 180 }; // для уровней 1,2,3; уровень 4 — постоянная блокировка

    @PostMapping("/login")
    public LoginResponse login(@RequestBody @Valid LoginRequest req) {
        var user = userRepository.findByLogin(req.getLogin())
                .orElseThrow(() -> new RuntimeException("ログインIDまたはパスワードが正しくありません"));

        if (!user.isActive()) {
            throw new RuntimeException("このアカウントは無効です。管理者にお問い合わせください");
        }

        // 恒久ロック（レベル4）— 常に拒否、パスワードすら見ない
        if (user.isAccountLocked()) {
            throw new RuntimeException("アカウントがロックされました。管理者にお問い合わせください。");
        }

        // 一時ロック中（レベル1〜3）— 期限内なら拒否、試行回数は変化させない
        if (user.getLockedUntil() != null && user.getLockedUntil().isAfter(Instant.now())) {
            throw new RuntimeException(lockDurationMessage(user.getLockLevel()));
        }

        if (!passwordEncoder.matches(req.getPassword(), user.getPasswordHash())) {
            registerFailedAttempt(user);
            throw new RuntimeException("ログインIDまたはパスワードが正しくありません");
        }

        // ログイン成功 — カウンターを全てリセット
        if (user.getFailedLoginAttempts() != 0 || user.getLockLevel() != 0 || user.getLockedUntil() != null) {
            user.setFailedLoginAttempts(0);
            user.setLockLevel(0);
            user.setLockedUntil(null);
            userRepository.save(user);
        }

        String token = user.getRole() == com.shiftapp.users.UserRole.KIOSK
            ? jwtService.generateKioskToken(new CustomUserDetails(user))
            : jwtService.generateAccessToken(new CustomUserDetails(user));
        return new LoginResponse(token);
    }
    
    private String lockDurationMessage(int lockLevel) {
        String duration = switch (lockLevel) {
            case 1 -> "10分間";
            case 2 -> "30分間";
            case 3 -> "3時間";
            default -> "しばらくの間";
        };
        return "ログイン試行回数が上限に達しました。" + duration + "ロックされます。時間をおいて再度お試しください。";
    }

    private void registerFailedAttempt(com.shiftapp.users.User user) {
        int attempts = user.getFailedLoginAttempts() + 1;
        user.setFailedLoginAttempts(attempts);

        for (int i = 0; i < LOCK_THRESHOLDS.length; i++) {
            if (attempts == LOCK_THRESHOLDS[i]) {
                int newLevel = i + 1;
                user.setLockLevel(newLevel);
                if (newLevel <= LOCK_MINUTES.length) {
                    user.setLockedUntil(Instant.now().plusSeconds(LOCK_MINUTES[newLevel - 1] * 60));
                } else {
                    user.setAccountLocked(true);
                    notificationMailService.notifyAccountLocked(
                            user.getRestaurant().getId(), user.getFullName());
                }
                break;
            }
        }

        userRepository.save(user);
    }
}