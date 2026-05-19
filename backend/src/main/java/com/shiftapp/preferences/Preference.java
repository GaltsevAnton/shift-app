package com.shiftapp.preferences;

import com.shiftapp.restaurants.Restaurant;
import com.shiftapp.users.User;
import jakarta.persistence.*;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "preferences")
public class Preference {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Version
    @Column(name = "version", nullable = false)
    private Long version = 0L;

    @ManyToOne(optional = false, fetch = FetchType.LAZY)
    @JoinColumn(name = "restaurant_id", nullable = false)
    private Restaurant restaurant;

    @ManyToOne(optional = false, fetch = FetchType.LAZY)
    @JoinColumn(name = "employee_id", nullable = false)
    private User user;

    @Column(name = "work_date", nullable = false)
    private LocalDate workDate;

    // off=true означает выходной (нет слотов)
    @Column(name = "is_off", nullable = false)
    private boolean off = false;

    @OneToMany(mappedBy = "preference", cascade = CascadeType.ALL, orphanRemoval = true,
               fetch = FetchType.LAZY)
    @OrderBy("slotOrder ASC")
    private List<ShiftSlot> slots = new ArrayList<>();

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private PreferenceStatus status = PreferenceStatus.DRAFT;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();

    @Column(length = 500)
    private String comment;

    public Preference() {}

    public Long getId() { return id; }
    public Long getVersion() { return version; }

    public Restaurant getRestaurant() { return restaurant; }
    public void setRestaurant(Restaurant restaurant) { this.restaurant = restaurant; }

    public User getUser() { return user; }
    public void setUser(User user) { this.user = user; }

    public LocalDate getWorkDate() { return workDate; }
    public void setWorkDate(LocalDate workDate) { this.workDate = workDate; }

    public boolean isOff() { return off; }
    public void setOff(boolean off) { this.off = off; }

    public List<ShiftSlot> getSlots() { return slots; }
    public void setSlots(List<ShiftSlot> slots) { this.slots = slots; }

    public PreferenceStatus getStatus() { return status; }
    public void setStatus(PreferenceStatus status) { this.status = status; }

    public Instant getCreatedAt() { return createdAt; }

    public String getComment() { return comment; }
    public void setComment(String comment) { this.comment = comment; }
}