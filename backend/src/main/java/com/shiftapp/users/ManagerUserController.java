package com.shiftapp.users;

import com.shiftapp.common.CurrentUser;
import com.shiftapp.users.dto.UserCreateRequest;
import com.shiftapp.users.dto.UserResponse;
import com.shiftapp.users.dto.UserUpdateRequest;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/manager/employees")
public class ManagerUserController {

    private final UserService service;

    public ManagerUserController(UserService service) {
        this.service = service;
    }

    @GetMapping
    public List<UserResponse> list() {
        var me = CurrentUser.require();
        return service.list(me.getRestaurantId());
    }

    @PostMapping
    public UserResponse create(@RequestBody @Valid UserCreateRequest req) {
        var me = CurrentUser.require();
        return service.create(me.getRestaurantId(), req);
    }

    @PutMapping("/{id}")
    public UserResponse update(@PathVariable Long id, @RequestBody @Valid UserUpdateRequest req) {
        var me = CurrentUser.require();
        return service.update(me.getRestaurantId(), id, req);
    }

    @DeleteMapping("/{id}")
    public void delete(@PathVariable Long id) {
        var me = CurrentUser.require();
        service.delete(me.getRestaurantId(), id);
    }
}