package com.shiftapp.reports;

import com.shiftapp.auth.security.CustomUserDetails;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import java.util.List;

import org.springframework.format.annotation.DateTimeFormat;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;

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
    
    /**
         * POST /api/manager/reports/attendance/sessions?from=2026-07-01&to=2026-07-31
         * Список смен (session-based), фильтр по сотрудникам — соответствует экрану リスト
         */
    @PostMapping("/attendance/sessions")
    @PreAuthorize("hasAnyRole('MANAGER','ADMIN')")
    public ResponseEntity<byte[]> attendanceSessions(
            @AuthenticationPrincipal CustomUserDetails user,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestBody(required = false) List<Long> userIds) {

        byte[] data = reportService.generateAttendanceSessions(user.getRestaurantId(), from, to, userIds);
        String filename = "勤怠リスト_" + from + "_" + to + ".xlsx";
        return xlsxResponse(data, filename);
    }

    /**
     * POST /api/manager/reports/shift/filtered
     * Шифт-таблица по выбранным сотрудникам
     */
    @PostMapping("/shift/filtered")
    @PreAuthorize("hasAnyRole('MANAGER','ADMIN')")
    public ResponseEntity<byte[]> shiftFiltered(
            @AuthenticationPrincipal CustomUserDetails user,
            @RequestParam String ym,
            @RequestBody List<Long> userIds) {

        byte[] data = reportService.generateShiftFiltered(user.getRestaurantId(), ym, userIds);
        String filename = "シフト_" + ym + "_選択.xlsx";
        return xlsxResponse(data, filename);
    }

    /**
     * GET /api/manager/reports/shift/all/range?from=&to=
     */
    @GetMapping("/shift/all/range")
    @PreAuthorize("hasAnyRole('MANAGER','ADMIN')")
    public ResponseEntity<byte[]> shiftAllRange(
            @AuthenticationPrincipal CustomUserDetails user,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {

        byte[] data = reportService.generateShiftAllRange(user.getRestaurantId(), from, to);
        String filename = "シフト_" + from + "_" + to + "_全員.xlsx";
        return xlsxResponse(data, filename);
    }

    /**
     * GET /api/manager/reports/shift/dept/range?from=&to=&department=
     */
    @GetMapping("/shift/dept/range")
    @PreAuthorize("hasAnyRole('MANAGER','ADMIN')")
    public ResponseEntity<byte[]> shiftDeptRange(
            @AuthenticationPrincipal CustomUserDetails user,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestParam String department) {

        byte[] data = reportService.generateShiftDeptRange(user.getRestaurantId(), from, to, department);
        String filename = "シフト_" + from + "_" + to + "_" + department + ".xlsx";
        return xlsxResponse(data, filename);
    }

    /**
     * GET /api/manager/reports/timesheet/range?from=&to=
     */
    @GetMapping("/timesheet/range")
    @PreAuthorize("hasAnyRole('MANAGER','ADMIN')")
    public ResponseEntity<byte[]> timesheetRange(
            @AuthenticationPrincipal CustomUserDetails user,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {

        byte[] data = reportService.generateTimesheetRange(user.getRestaurantId(), from, to);
        String filename = "勤怠_" + from + "_" + to + ".xlsx";
        return xlsxResponse(data, filename);
    }

    /**
     * POST /api/manager/reports/shift/filtered/range?from=&to=
     */
    @PostMapping("/shift/filtered/range")
    @PreAuthorize("hasAnyRole('MANAGER','ADMIN')")
    public ResponseEntity<byte[]> shiftFilteredRange(
            @AuthenticationPrincipal CustomUserDetails user,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestBody List<Long> userIds) {

        byte[] data = reportService.generateShiftFilteredRange(user.getRestaurantId(), from, to, userIds);
        String filename = "シフト_" + from + "_" + to + "_選択.xlsx";
        return xlsxResponse(data, filename);
    }

    /**
     * GET /api/manager/reports/attendance/timesheet?ym=2026-07
     * Табель фактического времени (по打刻)
     */
    @GetMapping("/attendance/timesheet")
    @PreAuthorize("hasAnyRole('MANAGER','ADMIN')")
    public ResponseEntity<byte[]> attendanceTimesheet(
            @AuthenticationPrincipal CustomUserDetails user,
            @RequestParam String ym) {

        byte[] data = reportService.generateAttendanceTimesheet(user.getRestaurantId(), ym);
        String filename = "勤怠集計_" + ym + ".xlsx";
        return xlsxResponse(data, filename);
    }

    /**
     * POST /api/manager/reports/attendance/timesheet/filtered?from=&to=
     * 勤怠集計表（実績）— по отфильтрованным на экране сотрудникам, произвольный диапазон дат
     */
    @PostMapping("/attendance/timesheet/filtered")
    @PreAuthorize("hasAnyRole('MANAGER','ADMIN')")
    public ResponseEntity<byte[]> attendanceTimesheetFiltered(
            @AuthenticationPrincipal CustomUserDetails user,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestBody(required = false) List<Long> userIds) {

        byte[] data = reportService.generateAttendanceTimesheetFiltered(user.getRestaurantId(), from, to, userIds);
        String filename = "勤怠集計_" + from + "_" + to + ".xlsx";
        return xlsxResponse(data, filename);
    }

    /**
     * GET /api/manager/reports/attendance/list?ym=2026-07
     * Плоский список всех打刻
     */
    @GetMapping("/attendance/list")
    @PreAuthorize("hasAnyRole('MANAGER','ADMIN')")
    public ResponseEntity<byte[]> attendanceList(
            @AuthenticationPrincipal CustomUserDetails user,
            @RequestParam String ym) {

        byte[] data = reportService.generateAttendanceList(user.getRestaurantId(), ym);
        String filename = "打刻一覧_" + ym + ".xlsx";
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