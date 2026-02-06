package com.shiftapp.common;

import com.shiftapp.restaurants.Restaurant;
import com.shiftapp.restaurants.RestaurantRepository;
import com.shiftapp.users.User;
import com.shiftapp.users.UserRepository;
import com.shiftapp.users.UserRole;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.crypto.password.PasswordEncoder;

@Configuration
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

            // 2) Manager user
            if (!userRepository.existsByLogin("manager")) {
                User u = new User();
                u.setRestaurant(restaurant);
                u.setLogin("manager");
                u.setFullName("Default Manager");
                u.setRole(UserRole.MANAGER);
                u.setPasswordHash(passwordEncoder.encode("manager123"));
                userRepository.save(u);

                System.out.println("=== Seed created manager ===");
                System.out.println("login: manager");
                System.out.println("password: manager123");
            }
        };
    }
}
