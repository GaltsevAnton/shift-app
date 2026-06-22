package com.shiftapp.users;

import com.shiftapp.restaurants.Restaurant;
import com.shiftapp.settings.department.Department;
import com.shiftapp.settings.department.DepartmentRepository;
import com.shiftapp.users.dto.UserCreateRequest;
import com.shiftapp.users.dto.UserResponse;
import com.shiftapp.users.dto.UserUpdateRequest;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import com.shiftapp.preferences.PreferenceRepository;
import com.shiftapp.preferences.ShiftSlotRepository;
import com.shiftapp.kiosk.TimeRecordRepository;

import java.util.HashSet;
import java.util.List;
import java.util.Set;

@Service
public class UserService {

    private final UserRepository repo;
    private final DepartmentRepository departmentRepo;
    private final PasswordEncoder passwordEncoder;
    private final PreferenceRepository preferenceRepo;
    private final ShiftSlotRepository  slotRepo;
    private final TimeRecordRepository timeRecordRepo;

    @PersistenceContext
    private EntityManager em;

    public UserService(UserRepository repo,
            DepartmentRepository departmentRepo,
            PasswordEncoder passwordEncoder,
            PreferenceRepository preferenceRepo,
            ShiftSlotRepository slotRepo,
            TimeRecordRepository timeRecordRepo) {
    this.repo           = repo;
    this.departmentRepo = departmentRepo;
    this.passwordEncoder = passwordEncoder;
    this.preferenceRepo = preferenceRepo;
    this.slotRepo       = slotRepo;
    this.timeRecordRepo = timeRecordRepo;
    }

    public List<UserResponse> list(Long restaurantId) {
        return repo.findAllByRestaurant_IdOrderByIdDesc(restaurantId)
                .stream()
                .map(UserResponse::from)
                .toList();
    }

    @Transactional
    public UserResponse create(Long restaurantId, UserCreateRequest req) {
        if (repo.findByLogin(req.login).isPresent()) {
            throw new RuntimeException("Login already exists");
        }
        User u = new User();
        u.setRestaurant(em.getReference(Restaurant.class, restaurantId));
        u.setLogin(req.login);

        u.setLastName(req.lastName);
        u.setFirstName(req.firstName);
        u.setLastNameKana(req.lastNameKana);
        u.setFirstNameKana(req.firstNameKana);
        u.setFullName(req.lastName + " " + req.firstName);
        u.setFullNameKana(req.lastNameKana + " " + req.firstNameKana);

        u.setPosition(req.position);
        u.setDepartments(resolveDepartments(restaurantId, req.departmentIds));
        u.setRole(req.role);
        u.setActive(true);
        u.setPasswordHash(passwordEncoder.encode(req.password));

        u.setEmail(req.email);
        u.setPhone(req.phone);
        u.setPostalCode(req.postalCode);
        u.setRegion(req.region);
        u.setMunicipality(req.municipality);
        u.setBlockNumber(req.blockNumber);
        u.setBuilding(req.building);
        u.setBirthDate(req.birthDate);
        u.setGender(req.gender);

        repo.save(u);
        return UserResponse.from(u);
    }

    @Transactional
    public UserResponse update(Long restaurantId, Long id, UserUpdateRequest req) {
        User u = repo.findByIdAndRestaurant_Id(id, restaurantId)
                .orElseThrow(() -> new RuntimeException("User not found"));

        if (!u.getLogin().equals(req.login) && repo.findByLogin(req.login).isPresent()) {
            throw new RuntimeException("Login already exists");
        }
        u.setLogin(req.login);

        u.setLastName(req.lastName);
        u.setFirstName(req.firstName);
        u.setLastNameKana(req.lastNameKana);
        u.setFirstNameKana(req.firstNameKana);
        u.setFullName(req.lastName + " " + req.firstName);
        u.setFullNameKana(req.lastNameKana + " " + req.firstNameKana);

        u.setPosition(req.position);
        u.setDepartments(resolveDepartments(restaurantId, req.departmentIds));
        u.setRole(req.role);
        u.setActive(req.active);

        if (req.password != null && !req.password.isBlank()) {
            u.setPasswordHash(passwordEncoder.encode(req.password));
        }

        u.setEmail(req.email);
        u.setPhone(req.phone);
        u.setPostalCode(req.postalCode);
        u.setRegion(req.region);
        u.setMunicipality(req.municipality);
        u.setBlockNumber(req.blockNumber);
        u.setBuilding(req.building);
        u.setBirthDate(req.birthDate);
        u.setGender(req.gender);

        return UserResponse.from(u);
    }

    @Transactional
    public void delete(Long restaurantId, Long id) {
        User u = repo.findByIdAndRestaurant_Id(id, restaurantId)
                .orElseThrow(() -> new RuntimeException("User not found"));
    
        List<Long> prefIds = preferenceRepo.findByUser_Id(id)
                .stream().map(p -> p.getId()).toList();
        if (!prefIds.isEmpty()) {
            slotRepo.deleteByPreferenceIdIn(prefIds);
            preferenceRepo.deleteAllById(prefIds);
        }
    
        timeRecordRepo.deleteByUserId(id);
    
        repo.delete(u);
    }

    // ── helpers ──
    private Set<Department> resolveDepartments(Long restaurantId, List<Long> ids) {
        if (ids == null || ids.isEmpty()) return new HashSet<>();
        var deps = departmentRepo.findAllById(ids);
        deps.forEach(d -> {
            if (!d.getRestaurant().getId().equals(restaurantId)) {
                throw new RuntimeException("Department does not belong to this restaurant");
            }
        });
        return new HashSet<>(deps);
    }
}