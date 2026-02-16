// DTO (Data Transfer Object) = “объект для передачи данных”.
// Проще: это класс-контейнер, который нужен, чтобы:
// принять данные из запроса (JSON → Java)
// или отправить данные в ответе (Java → JSON)
// DTO не должен содержать бизнес-логику (не должен “считать зарплату”, “логинить”, “ходить в БД”).
// Он просто хранит поля.
package com.shiftapp.auth.dto;

import jakarta.validation.constraints.NotBlank; //подключаем валидацию.
// @NotBlank означает:
// поле не может быть null
// и не может быть пустой строкой
// и не может быть строкой из пробелов " " тоже нельзя

public class LoginRequest {
    @NotBlank
    private String login;

    @NotBlank
    private String password;

    // Геттеры — чтобы читать значения в контроллере
    public String getLogin() { return login; }
    public String getPassword() { return password; }

    // Сеттеры — чтобы Spring мог записать значения при разборе JSON
    public void setLogin(String login) { this.login = login; }
    public void setPassword(String password) { this.password = password; }
}
