package com.shiftapp.users;

import com.shiftapp.common.CurrentUser;
import com.shiftapp.restaurants.RestaurantRepository;
import com.shiftapp.users.dto.UserResponse;
import jakarta.validation.constraints.NotBlank;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/manager/users")
public class ManagerUserController {

    private final UserRepository userRepository;
    private final RestaurantRepository restaurantRepository;
    private final PasswordEncoder passwordEncoder;

    public ManagerUserController(UserRepository userRepository,
                                 RestaurantRepository restaurantRepository,
                                 PasswordEncoder passwordEncoder) {
        this.userRepository = userRepository;
        this.restaurantRepository = restaurantRepository;
        this.passwordEncoder = passwordEncoder;
    }

    @GetMapping
    public List<UserResponse> listStaff() {
        var me = CurrentUser.require();
        Long rid = me.getRestaurantId();

        return userRepository.findByRestaurant_IdAndRoleOrderByFullNameAsc(rid, UserRole.STAFF)
                .stream()
                .map(u -> {
                    UserResponse r = new UserResponse();
                    r.setId(u.getId());
                    r.setLogin(u.getLogin());
                    r.setFullName(u.getFullName());
                    r.setRole(u.getRole());
                    r.setActive(u.isActive());
                    return r;
                })
                .toList();
    }

    @PostMapping("/create-staff")
    public String createStaff(@RequestParam @NotBlank String login,
                              @RequestParam @NotBlank String fullName,
                              @RequestParam @NotBlank String password) {

        var me = CurrentUser.require();
        Long restaurantId = me.getRestaurantId();

        if (userRepository.existsByLogin(login)) {
            return "login already exists";
        }

        var restaurant = restaurantRepository.findById(restaurantId).orElseThrow();

        User u = new User();
        u.setRestaurant(restaurant);
        u.setLogin(login);
        u.setFullName(fullName);
        u.setRole(UserRole.STAFF);
        u.setPasswordHash(passwordEncoder.encode(password));
        userRepository.save(u);

        return "created";
    }
}
