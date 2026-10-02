package com.shiftapp.roles;

import com.shiftapp.common.CurrentUser;
import com.shiftapp.roles.dto.RoleRequest;
import com.shiftapp.roles.dto.RoleResponse;
import jakarta.validation.Valid;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

// 権限管理はスーパー管理者（ADMIN）専用 — customRole の Permission では絶対に代替しない。
// でないと「ロールを編集できる」権限を持つ STAFF/MANAGER が自分自身に全権限を付与できてしまう。
@RestController
@RequestMapping("/api/manager/settings/roles")
@PreAuthorize("hasRole('ADMIN')")
public class RoleController {

    private final RoleService service;

    public RoleController(RoleService service) {
        this.service = service;
    }

    @GetMapping
    public List<RoleResponse> list() {
        return service.list(CurrentUser.require().getRestaurantId());
    }

    @PostMapping
    public RoleResponse create(@RequestBody @Valid RoleRequest req) {
        return service.create(CurrentUser.require().getRestaurantId(), req);
    }

    @PutMapping("/{id}")
    public RoleResponse update(@PathVariable Long id, @RequestBody @Valid RoleRequest req) {
        return service.update(CurrentUser.require().getRestaurantId(), id, req);
    }

    @DeleteMapping("/{id}")
    public void delete(@PathVariable Long id) {
        service.delete(CurrentUser.require().getRestaurantId(), id);
    }
}