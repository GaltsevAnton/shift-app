package com.shiftapp.preferences;

import com.shiftapp.common.CurrentUser;
import com.shiftapp.preferences.dto.PreferenceResponse;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;

@RestController
@RequestMapping("/api/manager/preferences")
public class ManagerPreferenceController {

    private final PreferenceService preferenceService;

    public ManagerPreferenceController(PreferenceService preferenceService) {
        this.preferenceService = preferenceService;
    }

    @GetMapping
    @PreAuthorize("hasAuthority('SHIFT_VIEW')")
    public List<PreferenceResponse> listForRestaurant(@RequestParam LocalDate from, @RequestParam LocalDate to) {
        var me = CurrentUser.require();
        return preferenceService.listForRestaurant(me.getRestaurantId(), from, to);
    }
}
