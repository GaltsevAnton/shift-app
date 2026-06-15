package com.shiftapp.kiosk;

import com.shiftapp.restaurants.Restaurant;
import com.shiftapp.users.User;
import jakarta.persistence.*;

import java.time.Instant;
import java.time.LocalDate;

@Entity
@Table(name = "time_records", indexes = {
    @Index(name = "idx_time_records_user_date",       columnList = "user_id, work_date"),
    @Index(name = "idx_time_records_restaurant_date", columnList = "restaurant_id, work_date")
})
public class TimeRecord {

    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(optional = false, fetch = FetchType.LAZY)
    @JoinColumn(name = "restaurant_id")
    private Restaurant restaurant;

    @ManyToOne(optional = false, fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id")
    private User user;

    @Enumerated(EnumType.STRING)
    @Column(name = "record_type", nullable = false, length = 20)
    private TimeRecordType recordType;

    @Column(name = "recorded_at", nullable = false)
    private Instant recordedAt;

    @Column(name = "work_date", nullable = false)
    private LocalDate workDate;

    @Column(name = "photo_path", length = 255)
    private String photoPath;

    @Column(name = "note", length = 500)
    private String note;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "edited_by_id")
    private User editedBy;

    @Column(name = "edited_at")
    private Instant editedAt;

    public Long getId() { return id; }

    public Restaurant getRestaurant() { return restaurant; }
    public void setRestaurant(Restaurant restaurant) { this.restaurant = restaurant; }

    public User getUser() { return user; }
    public void setUser(User user) { this.user = user; }

    public TimeRecordType getRecordType() { return recordType; }
    public void setRecordType(TimeRecordType recordType) { this.recordType = recordType; }

    public Instant getRecordedAt() { return recordedAt; }
    public void setRecordedAt(Instant recordedAt) { this.recordedAt = recordedAt; }

    public LocalDate getWorkDate() { return workDate; }
    public void setWorkDate(LocalDate workDate) { this.workDate = workDate; }

    public String getPhotoPath() { return photoPath; }
    public void setPhotoPath(String photoPath) { this.photoPath = photoPath; }

    public String getNote() { return note; }
    public void setNote(String note) { this.note = note; }

    public User getEditedBy() { return editedBy; }
    public void setEditedBy(User editedBy) { this.editedBy = editedBy; }

    public Instant getEditedAt() { return editedAt; }
    public void setEditedAt(Instant editedAt) { this.editedAt = editedAt; }
}