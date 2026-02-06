package com.shiftapp.weeks;

import com.shiftapp.restaurants.Restaurant;
import com.shiftapp.users.User;
import jakarta.persistence.*;

import java.time.Instant;
import java.time.LocalDate;

@Entity
@Table(name = "week_status",
       uniqueConstraints = @UniqueConstraint(columnNames = {"restaurant_id", "week_start"}))
public class WeekStatus {

    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(optional = false, fetch = FetchType.LAZY)
    private Restaurant restaurant;

    @Column(name = "week_start", nullable = false)
    private LocalDate weekStart; // always Monday

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private WeekStatusType status = WeekStatusType.RECEIVING;

    @ManyToOne(fetch = FetchType.LAZY)
    private User updatedBy;

    @Column(nullable = false)
    private Instant updatedAt = Instant.now();

    public Long getId() { return id; }
    public Restaurant getRestaurant() { return restaurant; }
    public void setRestaurant(Restaurant restaurant) { this.restaurant = restaurant; }

    public LocalDate getWeekStart() { return weekStart; }
    public void setWeekStart(LocalDate weekStart) { this.weekStart = weekStart; }

    public WeekStatusType getStatus() { return status; }
    public void setStatus(WeekStatusType status) { this.status = status; }

    public User getUpdatedBy() { return updatedBy; }
    public void setUpdatedBy(User updatedBy) { this.updatedBy = updatedBy; }

    public Instant getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(Instant updatedAt) { this.updatedAt = updatedAt; }
}
