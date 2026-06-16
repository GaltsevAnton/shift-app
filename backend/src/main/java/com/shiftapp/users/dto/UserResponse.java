package com.shiftapp.users.dto;

import com.shiftapp.users.Gender;
import com.shiftapp.users.User;
import com.shiftapp.users.UserRole;
import java.time.LocalDate;
import java.util.List;

public class UserResponse {
    public Long id;
    public String login;
    public String fullName;
    public String fullNameKana;
    public String position;
    public List<DeptItem> departments;
    public UserRole role;
    public boolean active;

    // ── Профиль ──
    public String lastName;
    public String firstName;
    public String lastNameKana;
    public String firstNameKana;
    public String email;
    public String phone;
    public String postalCode;
    public String region;
    public String municipality;
    public String blockNumber;
    public String building;
    public LocalDate birthDate;
    public Gender gender;

    public static class DeptItem {
        public Long id;
        public String name;
        public DeptItem(Long id, String name) { this.id = id; this.name = name; }
    }

    public static UserResponse from(User u) {
        var r = new UserResponse();
        r.id            = u.getId();
        r.login         = u.getLogin();
        r.fullName      = u.getFullName();
        r.fullNameKana  = u.getFullNameKana();
        r.position      = u.getPosition();
        r.role          = u.getRole();
        r.active        = u.isActive();
        r.departments   = u.getDepartments().stream()
                .map(d -> new DeptItem(d.getId(), d.getName()))
                .sorted((a, b) -> a.name.compareTo(b.name))
                .toList();

        r.lastName       = u.getLastName();
        r.firstName      = u.getFirstName();
        r.lastNameKana   = u.getLastNameKana();
        r.firstNameKana  = u.getFirstNameKana();
        r.email          = u.getEmail();
        r.phone          = u.getPhone();
        r.postalCode     = u.getPostalCode();
        r.region         = u.getRegion();
        r.municipality   = u.getMunicipality();
        r.blockNumber    = u.getBlockNumber();
        r.building       = u.getBuilding();
        r.birthDate      = u.getBirthDate();
        r.gender         = u.getGender();

        return r;
    }
}