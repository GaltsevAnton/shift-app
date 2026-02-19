package com.shiftapp.employees;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface EmployeeRepository extends JpaRepository<Employee, Long> {
    Optional<Employee> findByLogin(String login);
    List<Employee> findAllByRestaurant_IdOrderByIdDesc(Long restaurantId);
    Optional<Employee> findByIdAndRestaurant_Id(Long id, Long restaurantId);
}
