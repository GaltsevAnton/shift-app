package com.shiftapp.roles;

import com.shiftapp.restaurants.Restaurant;
import com.shiftapp.roles.dto.RoleRequest;
import com.shiftapp.roles.dto.RoleResponse;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import org.springframework.stereotype.Service;

import java.util.HashSet;
import java.util.List;

@Service
public class RoleService {

    private final RoleRepository repo;

    @PersistenceContext
    private EntityManager em;

    public RoleService(RoleRepository repo) {
        this.repo = repo;
    }

    public List<RoleResponse> list(Long restaurantId) {
        return repo.findByRestaurant_IdOrderByNameAsc(restaurantId)
                .stream().map(RoleResponse::from).toList();
    }

    public RoleResponse create(Long restaurantId, RoleRequest req) {
        String name = req.name.trim();
        if (repo.existsByRestaurant_IdAndName(restaurantId, name)) {
            throw new IllegalArgumentException("この名前のロールは既に存在します: " + name);
        }
        Role role = new Role();
        role.setRestaurant(em.getReference(Restaurant.class, restaurantId));
        role.setName(name);
        role.setPermissions(req.permissions != null ? new HashSet<>(req.permissions) : new HashSet<>());
        return RoleResponse.from(repo.save(role));
    }

    public RoleResponse update(Long restaurantId, Long id, RoleRequest req) {
        Role role = repo.findByIdAndRestaurant_Id(id, restaurantId)
                .orElseThrow(() -> new IllegalArgumentException("ロールが見つかりません"));

        String name = req.name.trim();
        if (repo.existsByRestaurant_IdAndNameAndIdNot(restaurantId, name, id)) {
            throw new IllegalArgumentException("この名前のロールは既に存在します: " + name);
        }

        role.setName(name);
        role.setPermissions(req.permissions != null ? new HashSet<>(req.permissions) : new HashSet<>());
        return RoleResponse.from(repo.save(role));
    }

    public void delete(Long restaurantId, Long id) {
        Role role = repo.findByIdAndRestaurant_Id(id, restaurantId)
                .orElseThrow(() -> new IllegalArgumentException("ロールが見つかりません"));
        // custom_role_id は ON DELETE SET NULL なので、割り当て済みユーザーは自動的に「ロールなし」になる
        repo.delete(role);
    }
}