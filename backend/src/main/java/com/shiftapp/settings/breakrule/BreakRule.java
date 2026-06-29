package com.shiftapp.settings.breakrule;

import com.shiftapp.restaurants.Restaurant;
import jakarta.persistence.*;

@Entity
@Table(name = "break_rules")
public class BreakRule {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "restaurant_id", nullable = false)
    private Restaurant restaurant;

    @Column(nullable = false)
    private String name;

    @Column(name = "threshold_minutes", nullable = false)
    private int thresholdMinutes;

    @Column(name = "break_minutes", nullable = false)
    private int breakMinutes;

    public BreakRule() {}

    public Long getId() { return id; }
    public Restaurant getRestaurant() { return restaurant; }
    public void setRestaurant(Restaurant r) { this.restaurant = r; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public int getThresholdMinutes() { return thresholdMinutes; }
    public void setThresholdMinutes(int thresholdMinutes) { this.thresholdMinutes = thresholdMinutes; }
    public int getBreakMinutes() { return breakMinutes; }
    public void setBreakMinutes(int breakMinutes) { this.breakMinutes = breakMinutes; }
}