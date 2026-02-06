package com.shiftapp.users;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;
import java.util.List;

public interface UserRepository extends JpaRepository<User, Long> {
    Optional<User> findByLogin(String login);
    boolean existsByLogin(String login);

    List<User> findByRestaurant_IdAndRoleOrderByFullNameAsc(Long restaurantId, UserRole role);
}
