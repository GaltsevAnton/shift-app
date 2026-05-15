package com.shiftapp.settings.position;

import com.shiftapp.common.CurrentUser;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/manager/settings/positions")
public class PositionController {

    private final PositionService service;

    public PositionController(PositionService service) {
        this.service = service;
    }

    @GetMapping
    public List<PositionResponse> list() {
        return service.list(CurrentUser.require().getRestaurantId());
    }

    @PostMapping
    public PositionResponse create(@RequestBody @Valid PositionRequest req) {
        return service.create(CurrentUser.require().getRestaurantId(), req);
    }

    @PutMapping("/{id}")
    public PositionResponse update(@PathVariable Long id, @RequestBody @Valid PositionRequest req) {
        return service.update(CurrentUser.require().getRestaurantId(), id, req);
    }

    @DeleteMapping("/{id}")
    public void delete(@PathVariable Long id) {
        service.delete(CurrentUser.require().getRestaurantId(), id);
    }
}