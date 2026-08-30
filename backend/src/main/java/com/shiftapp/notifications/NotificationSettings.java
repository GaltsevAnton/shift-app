package com.shiftapp.notifications;

import com.shiftapp.restaurants.Restaurant;
import jakarta.persistence.*;
import java.time.LocalTime;

@Entity
@Table(name = "notification_settings")
public class NotificationSettings {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "restaurant_id", nullable = false, unique = true)
    private Restaurant restaurant;

    @Column(name = "forgot_clockout_check_time", nullable = false)
    private LocalTime forgotClockoutCheckTime = LocalTime.MIDNIGHT;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Restaurant getRestaurant() { return restaurant; }
    public void setRestaurant(Restaurant restaurant) { this.restaurant = restaurant; }
    public LocalTime getForgotClockoutCheckTime() { return forgotClockoutCheckTime; }
    public void setForgotClockoutCheckTime(LocalTime t) { this.forgotClockoutCheckTime = t; }
}