package com.shiftapp.common;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class ManagerTestController {

    @GetMapping("/api/manager/ping")
    public String ping() {
        return "MANAGER_OK";
    }
}
