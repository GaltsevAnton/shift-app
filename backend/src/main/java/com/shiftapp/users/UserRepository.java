package com.shiftapp.users;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface UserRepository extends JpaRepository<User, Long> {

    Optional<User> findByLogin(String login);

    boolean existsByLogin(String login);

    Optional<User> findByIdAndRestaurant_Id(Long id, Long restaurantId);

    // Для списка сотрудников — с подгрузкой departments
    @Query("SELECT DISTINCT u FROM User u LEFT JOIN FETCH u.departments WHERE u.restaurant.id = :restaurantId ORDER BY u.id DESC")
    List<User> findAllByRestaurant_IdOrderByIdDesc(@Param("restaurantId") Long restaurantId);

    // Для шифта — без departments (не нужны)
    List<User> findByRestaurant_IdAndRoleOrderByFullNameAsc(Long restaurantId, UserRole role);

    List<User> findByRestaurant_IdAndRoleInOrderByFullNameAsc(Long restaurantId, List<UserRole> roles);
}