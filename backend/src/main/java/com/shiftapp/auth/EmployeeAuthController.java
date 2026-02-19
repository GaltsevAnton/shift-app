package com.shiftapp.auth;

import com.shiftapp.auth.dto.LoginRequest;
import com.shiftapp.auth.dto.LoginResponse;
import com.shiftapp.auth.security.CustomEmployeeDetails;
import com.shiftapp.employees.EmployeeRepository;
import jakarta.validation.Valid;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/employee/auth")
public class EmployeeAuthController {

    private final EmployeeRepository employeeRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;

    public EmployeeAuthController(EmployeeRepository employeeRepository,
                                  PasswordEncoder passwordEncoder,
                                  JwtService jwtService) {
        this.employeeRepository = employeeRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtService = jwtService;
    }

    @PostMapping("/login")
    public LoginResponse login(@RequestBody @Valid LoginRequest req) {
        var emp = employeeRepository.findByLogin(req.getLogin())
                .orElseThrow(() -> new RuntimeException("Invalid login or password"));

        if (!emp.isActive()) throw new RuntimeException("Employee is inactive");

        if (!passwordEncoder.matches(req.getPassword(), emp.getPasswordHash())) {
            throw new RuntimeException("Invalid login or password");
        }

        String token = jwtService.generateEmployeeAccessToken(new CustomEmployeeDetails(emp));
        return new LoginResponse(token);
    }
}
