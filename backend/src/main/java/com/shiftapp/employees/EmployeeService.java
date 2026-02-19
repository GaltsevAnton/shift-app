package com.shiftapp.employees;

import com.shiftapp.employees.dto.EmployeeCreateRequest;
import com.shiftapp.employees.dto.EmployeeResponse;
import com.shiftapp.employees.dto.EmployeeUpdateRequest;
import com.shiftapp.restaurants.Restaurant;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
public class EmployeeService {

    private final EmployeeRepository repo;
    private final PasswordEncoder passwordEncoder;

    @PersistenceContext
    private EntityManager em;

    public EmployeeService(EmployeeRepository repo, PasswordEncoder passwordEncoder) {
        this.repo = repo;
        this.passwordEncoder = passwordEncoder;
    }

    public List<EmployeeResponse> list(Long restaurantId) {
        return repo.findAllByRestaurant_IdOrderByIdDesc(restaurantId)
                .stream()
                .map(EmployeeResponse::from)
                .toList();
    }

    @Transactional
    public EmployeeResponse create(Long restaurantId, EmployeeCreateRequest req) {
        if (repo.findByLogin(req.login).isPresent()) {
            throw new RuntimeException("Login already exists");
        }

        Employee e = new Employee();
        Restaurant restaurantRef = em.getReference(Restaurant.class, restaurantId);

        e.setRestaurant(restaurantRef);
        e.setLogin(req.login);
        e.setFullName(req.fullName);
        e.setRole(req.role);
        e.setActive(true);
        e.setPasswordHash(passwordEncoder.encode(req.password));

        repo.save(e);
        return EmployeeResponse.from(e);
    }

    @Transactional
    public EmployeeResponse update(Long restaurantId, Long id, EmployeeUpdateRequest req) {
        Employee e = repo.findByIdAndRestaurant_Id(id, restaurantId)
                .orElseThrow(() -> new RuntimeException("Employee not found"));

        // если меняем логин — проверяем уникальность
        if (!e.getLogin().equals(req.login) && repo.findByLogin(req.login).isPresent()) {
            throw new RuntimeException("Login already exists");
        }

        e.setLogin(req.login);
        e.setFullName(req.fullName);
        e.setRole(req.role);
        e.setActive(req.active);

        if (req.password != null && !req.password.isBlank()) {
            e.setPasswordHash(passwordEncoder.encode(req.password));
        }

        return EmployeeResponse.from(e);
    }

    @Transactional
    public void delete(Long restaurantId, Long id) {
        Employee e = repo.findByIdAndRestaurant_Id(id, restaurantId)
                .orElseThrow(() -> new RuntimeException("Employee not found"));
        repo.delete(e);
    }
}
