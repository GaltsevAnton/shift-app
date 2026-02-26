package com.shiftapp.common;

import com.shiftapp.restaurants.Restaurant;
import com.shiftapp.restaurants.RestaurantRepository;
import com.shiftapp.users.User;
import com.shiftapp.users.UserRepository;
import com.shiftapp.users.UserRole;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;
import org.springframework.security.crypto.password.PasswordEncoder;

@Configuration
@Profile("!prod") // не запускать в production
public class SeedData {

    @Bean
    CommandLineRunner seed(RestaurantRepository restaurantRepository,
                           UserRepository userRepository,
                           PasswordEncoder passwordEncoder) {
        return args -> {
            // 1) Restaurant
            Restaurant restaurant;
            if (!restaurantRepository.existsByName("Hanno Restaurant")) {
                restaurant = new Restaurant("Hanno Restaurant");
                restaurantRepository.save(restaurant);
            } else {
                restaurant = restaurantRepository.findAll().stream()
                        .filter(r -> r.getName().equals("Hanno Restaurant"))
                        .findFirst()
                        .orElseThrow();
            }

            // 2) Manager
            if (!userRepository.existsByLogin("manager")) {
                User manager = new User();
                manager.setRestaurant(restaurant);
                manager.setLogin("manager");
                manager.setFullName("Default Manager");
                manager.setRole(UserRole.MANAGER);
                manager.setPasswordHash(passwordEncoder.encode("manager123"));
                userRepository.save(manager);

                System.out.println("=== Seed: manager / manager123 ===");
            }

            // 3) Staff (тестовый сотрудник)
            if (!userRepository.existsByLogin("anton")) {
                User staff = new User();
                staff.setRestaurant(restaurant);
                staff.setLogin("anton");
                staff.setFullName("Anton Staff");
                staff.setRole(UserRole.STAFF);
                staff.setPasswordHash(passwordEncoder.encode("pass123"));
                userRepository.save(staff);

                System.out.println("=== Seed: anton / pass123 ===");
            }
        };
    }
}