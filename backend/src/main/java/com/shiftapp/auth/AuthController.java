package com.shiftapp.auth;

import com.shiftapp.auth.dto.LoginRequest;
import com.shiftapp.auth.dto.LoginResponse;
import com.shiftapp.auth.security.CustomUserDetails;
import jakarta.validation.Valid;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final com.shiftapp.users.UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;

    public AuthController(com.shiftapp.users.UserRepository userRepository,
                          PasswordEncoder passwordEncoder,
                          JwtService jwtService) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtService = jwtService;
    }

    @PostMapping("/login")
    public LoginResponse login(@RequestBody @Valid LoginRequest req) {
        var user = userRepository.findByLogin(req.getLogin())
                .orElseThrow(() -> new RuntimeException("Invalid login or password"));

        if (!user.isActive()) {
            throw new RuntimeException("User is inactive");
        }

        if (!passwordEncoder.matches(req.getPassword(), user.getPasswordHash())) {
            throw new RuntimeException("Invalid login or password");
        }

        String token = jwtService.generateAccessToken(new CustomUserDetails(user));
        return new LoginResponse(token);
    }
}
