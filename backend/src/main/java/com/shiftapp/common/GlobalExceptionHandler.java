package com.shiftapp.common;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.util.Map;

@RestControllerAdvice
public class GlobalExceptionHandler {

    // Бизнес-ошибки (неверный пароль, не найден и т.д.)
    @ExceptionHandler(RuntimeException.class)
    public ResponseEntity<Map<String, String>> handleRuntime(RuntimeException ex) {
        String msg = ex.getMessage();
        // Определяем HTTP статус по тексту ошибки
        HttpStatus status = HttpStatus.BAD_REQUEST;
        if (msg != null && msg.contains("inactive")) {
            status = HttpStatus.FORBIDDEN;
        }
        return ResponseEntity.status(status)
                .body(Map.of("message", msg != null ? msg : "エラーが発生しました"));
    }

    // Ошибки валидации (@Valid)
    @ExceptionHandler(org.springframework.web.bind.MethodArgumentNotValidException.class)
    public ResponseEntity<Map<String, String>> handleValidation(
            org.springframework.web.bind.MethodArgumentNotValidException ex) {
        String msg = ex.getBindingResult().getFieldErrors().stream()
                .map(e -> e.getDefaultMessage())
                .findFirst()
                .orElse("入力エラー");
        return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                .body(Map.of("message", msg));
    }
}