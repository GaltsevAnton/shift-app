package com.shiftapp.users;

import com.shiftapp.common.CurrentUser;
import com.shiftapp.restaurants.RestaurantRepository;
import com.shiftapp.users.dto.UserResponse;
import jakarta.validation.constraints.NotBlank;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
//это API контроллер: возвращает данные (JSON/строки), а не HTML.
@RequestMapping("/api/manager/users")
// — базовый путь. Всё внутри будет начинаться с: /api/manager/users
public class ManagerUserController {

    private final UserRepository userRepository;    //— искать/сохранять пользователей в БД.
    private final RestaurantRepository restaurantRepository; //— получить ресторан из БД, чтобы привязать сотрудника к ресторану.
    private final PasswordEncoder passwordEncoder;  //— сделать хэш пароля перед сохранением.

    public ManagerUserController(UserRepository userRepository,
                                 RestaurantRepository restaurantRepository,
                                 PasswordEncoder passwordEncoder) {
        this.userRepository = userRepository;
        this.restaurantRepository = restaurantRepository;
        this.passwordEncoder = passwordEncoder;
    }

    @GetMapping
    // @GetMapping = “дай посмотреть”
    // Используется для получения данных (читать, показать).
    public List<UserResponse> listStaff() {     //Потому что @GetMapping без пути, берётся путь класса: GET /api/manager/users
        var me = CurrentUser.require();
        Long rid = me.getRestaurantId();

        return userRepository.findByRestaurant_IdAndRoleOrderByFullNameAsc(rid, UserRole.STAFF) //Вернёт список User (Entity) сотрудников, отсортированных по fullName.
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
                /*
                Чтобы не отдавать Entity наружу и не случайно не отправить лишнее (например passwordHash).
                Внутри map ты вручную копируешь нужные поля:
                id
                login
                fullName
                role
                active
                И возвращаешь список List<UserResponse>.
                Итог: менеджер получает JSON со списком сотрудников.            
                */
    }

    @PostMapping("/create-staff")
    /* @PostMapping = “сделай действие / отправляю данные”
    Используется для создания/действия (добавить, логин, отправить).*/
    public String createStaff(@RequestParam @NotBlank String login,
                              @RequestParam @NotBlank String fullName,
                              @RequestParam @NotBlank String password) {
                            /*
                            Почему тут @RequestParam, а не @RequestBody?
                            @RequestParam означает, что параметры приходят как:
                            query string (?login=...) или
                            application/x-www-form-urlencoded (форма)
                            Если бы ты хотел JSON, ты бы делал @RequestBody CreateStaffRequest.
                            */

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
