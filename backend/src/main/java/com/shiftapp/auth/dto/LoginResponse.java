package com.shiftapp.auth.dto;

public class LoginResponse {   
    //Это DTO для ответа. То есть объект, который ты возвращаешь из контроллера после успешного логина.
    private String accessToken;
    // Это то, что уйдёт клиенту: строка JWT.
    // Важно: имя поля влияет на JSON, который увидит клиент.
    // например: { "accessToken": "abc" }

    public LoginResponse() {}
    public LoginResponse(String accessToken) { this.accessToken = accessToken; }

    public String getAccessToken() { return accessToken; }
    public void setAccessToken(String accessToken) { this.accessToken = accessToken; }
}
