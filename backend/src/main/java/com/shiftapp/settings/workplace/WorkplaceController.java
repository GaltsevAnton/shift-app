package com.shiftapp.settings.workplace;

import com.shiftapp.common.CurrentUser;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/manager/settings/workplaces")
public class WorkplaceController {

    private final WorkplaceService service;

    public WorkplaceController(WorkplaceService service) {
        this.service = service;
    }

    @GetMapping
    public List<WorkplaceResponse> list() {
        return service.list(CurrentUser.require().getRestaurantId());
    }

    @PostMapping
    public WorkplaceResponse create(@RequestBody @Valid WorkplaceRequest req) {
        return service.create(CurrentUser.require().getRestaurantId(), req);
    }

    @PutMapping("/{id}")
    public WorkplaceResponse update(@PathVariable Long id, @RequestBody @Valid WorkplaceRequest req) {
        return service.update(CurrentUser.require().getRestaurantId(), id, req);
    }

    @DeleteMapping("/{id}")
    public void delete(@PathVariable Long id) {
        service.delete(CurrentUser.require().getRestaurantId(), id);
    }
}