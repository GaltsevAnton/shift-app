package com.shiftapp.users.dto;

import com.shiftapp.users.Gender;
import com.shiftapp.users.UserRole;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.time.LocalDate;
import java.util.List;

public class UserUpdateRequest {
    @NotBlank public String login;

    @NotBlank public String lastName;
    @NotBlank public String firstName;
    @NotBlank public String lastNameKana;
    @NotBlank public String firstNameKana;

    public String position;
    public List<Long> departmentIds;
    @NotNull  public UserRole role;
    public boolean active;
    public String password;

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