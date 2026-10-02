package com.shiftapp.settings.department;

import com.shiftapp.common.CurrentUser;
import jakarta.validation.Valid;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/manager/settings/departments")
public class DepartmentController {

    private final DepartmentService service;

    public DepartmentController(DepartmentService service) {
        this.service = service;
    }

    @GetMapping
    @PreAuthorize("hasAuthority('DEPARTMENT_VIEW')")
    public List<DepartmentResponse> list() {
        return service.list(CurrentUser.require().getRestaurantId());
    }

    @PostMapping
    @PreAuthorize("hasAuthority('DEPARTMENT_CREATE')")
    public DepartmentResponse create(@RequestBody @Valid DepartmentRequest req) {
        return service.create(CurrentUser.require().getRestaurantId(), req);
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAuthority('DEPARTMENT_EDIT')")
    public DepartmentResponse update(@PathVariable Long id, @RequestBody @Valid DepartmentRequest req) {
        return service.update(CurrentUser.require().getRestaurantId(), id, req);
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAuthority('DEPARTMENT_DELETE')")
    public void delete(@PathVariable Long id) {
        service.delete(CurrentUser.require().getRestaurantId(), id);
    }

    @PutMapping("/reorder")
    @PreAuthorize("hasAuthority('DEPARTMENT_EDIT')")
    public void reorder(@RequestBody List<Long> orderedIds) {
        service.reorder(CurrentUser.require().getRestaurantId(), orderedIds);
    }
}