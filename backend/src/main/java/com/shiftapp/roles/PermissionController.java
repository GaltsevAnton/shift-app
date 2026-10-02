package com.shiftapp.roles;

import com.shiftapp.common.CurrentUser;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Arrays;
import java.util.List;

@RestController
@RequestMapping("/api/manager/settings/permissions")
@PreAuthorize("hasRole('ADMIN')")
public class PermissionController {

    @GetMapping
    public List<String> list() {
        CurrentUser.require(); // просто чтобы дёрнуть аутентификацию/скоуп, значения от ресторана не зависят
        return Arrays.stream(Permission.values()).map(Enum::name).toList();
    }
}