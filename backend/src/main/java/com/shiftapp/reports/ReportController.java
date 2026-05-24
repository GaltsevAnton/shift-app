package com.shiftapp.reports;

import com.shiftapp.auth.security.CustomUserDetails;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;

@RestController
@RequestMapping("/api/manager/reports")
public class ReportController {

    private final ReportService reportService;

    public ReportController(ReportService reportService) {
        this.reportService = reportService;
    }

    /**
     * GET /api/manager/reports/shift/dept?ym=2026-05&department=洋食
     * Шифт-таблица по отделу
     */
    @GetMapping("/shift/dept")
    @PreAuthorize("hasAnyRole('MANAGER','ADMIN')")
    public ResponseEntity<byte[]> shiftByDept(
            @AuthenticationPrincipal CustomUserDetails user,
            @RequestParam String ym,
            @RequestParam String department) {

        byte[] data = reportService.generateShiftDept(user.getRestaurantId(), ym, department);
        String filename = "シフト_" + ym + "_" + department + ".xlsx";
        return xlsxResponse(data, filename);
    }

    /**
     * GET /api/manager/reports/shift/all?ym=2026-05
     * Сводная шифт-таблица по всем сотрудникам
     */
    @GetMapping("/shift/all")
    @PreAuthorize("hasAnyRole('MANAGER','ADMIN')")
    public ResponseEntity<byte[]> shiftAll(
            @AuthenticationPrincipal CustomUserDetails user,
            @RequestParam String ym) {

        byte[] data = reportService.generateShiftAll(user.getRestaurantId(), ym);
        String filename = "シフト_" + ym + "_全員.xlsx";
        return xlsxResponse(data, filename);
    }

    /**
     * GET /api/manager/reports/timesheet?ym=2026-05
     * Табель учёта рабочего времени
     */
    @GetMapping("/timesheet")
    @PreAuthorize("hasAnyRole('MANAGER','ADMIN')")
    public ResponseEntity<byte[]> timesheet(
            @AuthenticationPrincipal CustomUserDetails user,
            @RequestParam String ym) {

        byte[] data = reportService.generateTimesheet(user.getRestaurantId(), ym);
        String filename = "勤怠_" + ym + ".xlsx";
        return xlsxResponse(data, filename);
    }

    // ── helper ────────────────────────────────────────────────────────────

    private ResponseEntity<byte[]> xlsxResponse(byte[] data, String filename) {
        String encoded = URLEncoder.encode(filename, StandardCharsets.UTF_8)
                .replace("+", "%20");
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(
                        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"))
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        "attachment; filename*=UTF-8''" + encoded)
                .header(HttpHeaders.CONTENT_LENGTH, String.valueOf(data.length))
                .body(data);
    }
}