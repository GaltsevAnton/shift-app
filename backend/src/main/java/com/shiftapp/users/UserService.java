package com.shiftapp.users;

import com.shiftapp.auth.security.CustomUserDetails;
import com.shiftapp.common.CurrentUser;
import org.springframework.security.core.GrantedAuthority;
import java.util.Objects;
import java.util.stream.Collectors;
import com.shiftapp.notifications.NotificationMailService;
import com.shiftapp.restaurants.Restaurant;
import com.shiftapp.roles.Role;
import com.shiftapp.roles.RoleRepository;
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
    private final RoleRepository roleRepo;
    private final PasswordEncoder passwordEncoder;
    private final PreferenceRepository preferenceRepo;
    private final ShiftSlotRepository  slotRepo;
    private final TimeRecordRepository timeRecordRepo;
    private final NotificationMailService notificationMailService;

    @PersistenceContext
    private EntityManager em;

    public UserService(UserRepository repo,
            DepartmentRepository departmentRepo,
            RoleRepository roleRepo,
            PasswordEncoder passwordEncoder,
            PreferenceRepository preferenceRepo,
            ShiftSlotRepository slotRepo,
            TimeRecordRepository timeRecordRepo,
            NotificationMailService notificationMailService) {
    this.repo           = repo;
    this.departmentRepo = departmentRepo;
    this.roleRepo       = roleRepo;
    this.passwordEncoder = passwordEncoder;
    this.preferenceRepo = preferenceRepo;
    this.slotRepo       = slotRepo;
    this.timeRecordRepo = timeRecordRepo;
    this.notificationMailService = notificationMailService;
    }

    public List<UserResponse> list(Long restaurantId) {
        return repo.findAllByRestaurant_IdOrderByIdDesc(restaurantId)
                .stream()
                .map(UserResponse::from)
                .toList();
    }

    @Transactional
    public UserResponse create(Long restaurantId, UserCreateRequest req) {
        var actor = CurrentUser.require();
        if (req.role == UserRole.ADMIN && !isAdmin(actor)) {
            throw new RuntimeException("ADMINロールを付与できるのは管理者のみです");
        }

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

        if (repo.existsByRestaurant_IdAndSortOrder(restaurantId, req.sortOrder)) {
            throw new RuntimeException("この順番№は既に使用されています");
        }

        u.setPosition(req.position);
        u.setDepartments(resolveDepartments(restaurantId, req.departmentIds));
        u.setRole(req.role);
        u.setSortOrder(req.sortOrder);
        u.setActive(true);
        u.setPasswordHash(passwordEncoder.encode(req.password));
        Role customRole = resolveCustomRole(restaurantId, req.customRoleId);
        ensureCanGrant(actor, customRole);
        u.setCustomRole(customRole);

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

        String createdBy = CurrentUser.require().getFullName();
        notificationMailService.notifyEmployeeCreated(restaurantId, u.getFullName(), createdBy);

        return UserResponse.from(u);
    }

    @Transactional
    public UserResponse update(Long restaurantId, Long id, UserUpdateRequest req) {
        User u = repo.findByIdAndRestaurant_Id(id, restaurantId)
                .orElseThrow(() -> new RuntimeException("User not found"));

        var actor = CurrentUser.require();
        boolean actorIsAdmin = isAdmin(actor);

        if (u.getRole() == UserRole.ADMIN && !actorIsAdmin) {
            throw new RuntimeException("管理者アカウントを編集できるのは管理者のみです");
        }
        if (req.role == UserRole.ADMIN && !actorIsAdmin) {
            throw new RuntimeException("ADMINロールを付与できるのは管理者のみです");
        }
        // последнего ADMIN нельзя понизить или деактивировать (иначе снова только через SQL)
        if (u.getRole() == UserRole.ADMIN
                && (req.role != UserRole.ADMIN || !req.active)
                && repo.countByRestaurant_IdAndRole(restaurantId, UserRole.ADMIN) <= 1) {
            throw new RuntimeException("最後の管理者のロール変更・無効化はできません");
        }

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

        if (u.getSortOrder() != req.sortOrder
                && repo.existsByRestaurant_IdAndSortOrderAndIdNot(restaurantId, req.sortOrder, id)) {
            throw new RuntimeException("この順番№は既に使用されています");
        }

        u.setPosition(req.position);
        u.setDepartments(resolveDepartments(restaurantId, req.departmentIds));
        u.setRole(req.role);
        u.setSortOrder(req.sortOrder);
        u.setActive(req.active);
        // проверяем, только если роль реально меняется —
        // иначе менеджер с урезанными правами не смог бы сохранить даже телефон у сотрудника с «フルアクセス»
        Long currentRoleId = u.getCustomRole() != null ? u.getCustomRole().getId() : null;
        if (!Objects.equals(currentRoleId, req.customRoleId)) {
            Role customRole = resolveCustomRole(restaurantId, req.customRoleId);
            ensureCanGrant(actor, customRole);
            u.setCustomRole(customRole);
        }

        if (req.password != null && !req.password.isBlank()) {
            u.setPasswordHash(passwordEncoder.encode(req.password));

            notificationMailService.notifyPasswordChanged(
                    restaurantId, u.getFullName(), actor.getFullName(), actor.getUserId());
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

        if (u.getRole() == UserRole.ADMIN) {
            if (!isAdmin(CurrentUser.require())) {
                throw new RuntimeException("管理者アカウントを削除できるのは管理者のみです");
            }
            if (repo.countByRestaurant_IdAndRole(restaurantId, UserRole.ADMIN) <= 1) {
                throw new RuntimeException("最後の管理者は削除できません");
            }
        }

        String userName = u.getFullName();
        String deletedBy = CurrentUser.require().getFullName();

        List<Long> prefIds = preferenceRepo.findByUser_Id(id)
                .stream().map(p -> p.getId()).toList();
        if (!prefIds.isEmpty()) {
            slotRepo.deleteByPreferenceIdIn(prefIds);
            preferenceRepo.deleteAllById(prefIds);
        }
    
        timeRecordRepo.deleteByUserId(id);
    
        repo.delete(u);

        notificationMailService.notifyEmployeeDeleted(restaurantId, userName, deletedBy);
    }

    // ── 権限チェック（privilege escalation 防止） ──
    private static boolean isAdmin(CustomUserDetails actor) {
        return actor.getAuthorities().stream()
                .anyMatch(a -> "ROLE_ADMIN".equals(a.getAuthority()));
    }

    /** Не-ADMIN может назначить только роль, все права которой есть у него самого. */
    private static void ensureCanGrant(CustomUserDetails actor, Role role) {
        if (role == null || isAdmin(actor)) return;
        Set<String> mine = actor.getAuthorities().stream()
                .map(GrantedAuthority::getAuthority)
                .collect(Collectors.toSet());
        boolean ok = role.getPermissions().stream()
                .allMatch(p -> mine.contains(p.name()));
        if (!ok) {
            throw new RuntimeException("自分が持っていない権限を含むロールは割り当てできません");
        }
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

    private Role resolveCustomRole(Long restaurantId, Long customRoleId) {
        if (customRoleId == null) return null;
        Role role = roleRepo.findByIdAndRestaurant_Id(customRoleId, restaurantId)
                .orElseThrow(() -> new RuntimeException("Role does not belong to this restaurant"));
        return role;
    }
}