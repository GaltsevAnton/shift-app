package com.shiftapp.preferences;

import com.shiftapp.common.CurrentUser;
import com.shiftapp.preferences.dto.PreferenceResponse;
import com.shiftapp.preferences.dto.UpsertPreferenceRequest;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;

@RestController
@RequestMapping("/api/staff/preferences")
public class StaffPreferenceController {

    private final PreferenceService preferenceService;

    public StaffPreferenceController(PreferenceService preferenceService) {
        this.preferenceService = preferenceService;
    }

    @PostMapping
    public PreferenceResponse upsert(@RequestBody @Valid UpsertPreferenceRequest req) {
        var me = CurrentUser.require();
        return preferenceService.upsertForUser(me.getUserId(), req);
    }

    @GetMapping
    public List<PreferenceResponse> list(@RequestParam LocalDate from, @RequestParam LocalDate to) {
        var me = CurrentUser.require();
        return preferenceService.listForUser(me.getUserId(), from, to);
    }
}
