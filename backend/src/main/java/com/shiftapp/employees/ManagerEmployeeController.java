package com.shiftapp.employees;

import com.shiftapp.common.CurrentUser;
import com.shiftapp.employees.dto.EmployeeCreateRequest;
import com.shiftapp.employees.dto.EmployeeResponse;
import com.shiftapp.employees.dto.EmployeeUpdateRequest;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/manager/employees")
public class ManagerEmployeeController {

    private final EmployeeService service;

    public ManagerEmployeeController(EmployeeService service) {
        this.service = service;
    }

    @GetMapping
    public List<EmployeeResponse> list() {
        var me = CurrentUser.require();
        return service.list(me.getRestaurantId());
    }

    @PostMapping
    public EmployeeResponse create(@RequestBody @Valid EmployeeCreateRequest req) {
        var me = CurrentUser.require();
        return service.create(me.getRestaurantId(), req);
    }

    @PutMapping("/{id}")
    public EmployeeResponse update(@PathVariable Long id, @RequestBody @Valid EmployeeUpdateRequest req) {
        var me = CurrentUser.require();
        return service.update(me.getRestaurantId(), id, req);
    }

    @DeleteMapping("/{id}")
    public void delete(@PathVariable Long id) {
        var me = CurrentUser.require();
        service.delete(me.getRestaurantId(), id);
    }
}
