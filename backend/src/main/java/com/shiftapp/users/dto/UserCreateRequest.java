package com.shiftapp.users.dto;

import com.shiftapp.users.Gender;
import com.shiftapp.users.UserRole;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.time.LocalDate;
import java.util.List;

public class UserCreateRequest {
    @NotBlank public String login;

    // 名前 (имя/фамилия раздельно — обязательны)
    @NotBlank public String lastName;
    @NotBlank public String firstName;
    @NotBlank public String lastNameKana;
    @NotBlank public String firstNameKana;

    public String position;
    public List<Long> departmentIds;
    @NotNull  public UserRole role;
    @NotBlank public String password;

    // ── Опциональные поля профиля ──
    public String email;
    public String phone;
    public String postalCode;
    public String region;
    public String municipality;
    public String blockNumber;
    public String building;

    public LocalDate birthDate;
    public Gender gender;
}