package com.shiftapp.users;

import com.shiftapp.restaurants.Restaurant;
import com.shiftapp.users.dto.UserCreateRequest;
import com.shiftapp.users.dto.UserResponse;
import com.shiftapp.users.dto.UserUpdateRequest;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
public class UserService {

    private final UserRepository repo;
    private final PasswordEncoder passwordEncoder;

    @PersistenceContext
    private EntityManager em;

    public UserService(UserRepository repo, PasswordEncoder passwordEncoder) {
        this.repo = repo;
        this.passwordEncoder = passwordEncoder;
    }

    // список всех пользователей ресторана
    public List<UserResponse> list(Long restaurantId) {
        return repo.findAllByRestaurant_IdOrderByIdDesc(restaurantId)
                .stream()
                .map(UserResponse::from)
                .toList();
    }

    // создать нового пользователя
    @Transactional
    public UserResponse create(Long restaurantId, UserCreateRequest req) {
        if (repo.findByLogin(req.login).isPresent()) {
            throw new RuntimeException("Login already exists");
        }

        User u = new User();
        u.setRestaurant(em.getReference(Restaurant.class, restaurantId));
        u.setLogin(req.login);
        u.setFullName(req.fullName);
        u.setRole(req.role);
        u.setActive(true);
        u.setPasswordHash(passwordEncoder.encode(req.password));

        repo.save(u);
        return UserResponse.from(u);
    }

    // обновить пользователя
    @Transactional
    public UserResponse update(Long restaurantId, Long id, UserUpdateRequest req) {
        User u = repo.findByIdAndRestaurant_Id(id, restaurantId)
                .orElseThrow(() -> new RuntimeException("User not found"));

        // если меняем логин — проверяем уникальность
        if (!u.getLogin().equals(req.login) && repo.findByLogin(req.login).isPresent()) {
            throw new RuntimeException("Login already exists");
        }

        u.setLogin(req.login);
        u.setFullName(req.fullName);
        u.setRole(req.role);
        u.setActive(req.active);

        if (req.password != null && !req.password.isBlank()) {
            u.setPasswordHash(passwordEncoder.encode(req.password));
        }

        return UserResponse.from(u);
    }

    // удалить пользователя
    @Transactional
    public void delete(Long restaurantId, Long id) {
        User u = repo.findByIdAndRestaurant_Id(id, restaurantId)
                .orElseThrow(() -> new RuntimeException("User not found"));
        repo.delete(u);
    }
}