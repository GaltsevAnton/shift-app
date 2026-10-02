package com.shiftapp.roles;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface RoleRepository extends JpaRepository<Role, Long> {

    List<Role> findByRestaurant_IdOrderByNameAsc(Long restaurantId);

    Optional<Role> findByIdAndRestaurant_Id(Long id, Long restaurantId);

    boolean existsByRestaurant_IdAndName(Long restaurantId, String name);

    boolean existsByRestaurant_IdAndNameAndIdNot(Long restaurantId, String name, Long id);
}