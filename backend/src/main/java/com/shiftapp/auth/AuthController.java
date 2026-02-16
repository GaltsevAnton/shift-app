package com.shiftapp.auth; //это подпакет, где Spring начинает сканировать пакет, где лежит главный класс (com.shiftapp), 
// и все подпакеты. 

import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.shiftapp.auth.dto.LoginRequest;      //берем из файла ./dto/LoginRequest.java
import com.shiftapp.auth.dto.LoginResponse;     //берем из файла ./dto/LoginResponse.java
import com.shiftapp.auth.security.CustomUserDetails;

import jakarta.validation.Valid;

@RestController   //При старте приложения Spring находит все классы с @RestController (и @Controller) и регистрирует их.
@RequestMapping("/api/auth")  //URL-путь (маршрут), дальше будет добавляться ниже, например, /login и (см. ниже)...
public class AuthController {       //Это имя класса. Обычно по названию понятно назначение
//public = “виден отовсюду”

    // это“инструменты”, которые контроллер использует, чтобы выполнить логин.
    private final com.shiftapp.users.UserRepository userRepository;  //работа с базой данных
    // private - Эти поля видны только внутри AuthController
    // final - Значит: после того как значение присвоено (в конструкторе), его нельзя заменить.
    private final PasswordEncoder passwordEncoder;  //это “проверяльщик паролей”.
    private final JwtService jwtService; //сервис, который делает JWT. после успешного логина он генерирует строку токена, 
    // которую ты отдаёшь клиенту.

    // То есть контроллер всегда будет работать с теми же объектами userRepository, passwordEncoder, jwtService.

    public AuthController(com.shiftapp.users.UserRepository userRepository,
                          PasswordEncoder passwordEncoder,
                          JwtService jwtService) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtService = jwtService;
    }
    // Это конструктор класса AuthController. 
    // Его задача — получить нужные “инструменты” и сохранить их в полях, чтобы потом метод login() мог ими пользоваться.

    @PostMapping("/login")  //..и если обраться к пути "/api/auth/login", то обработаеться этот путь
    public LoginResponse login(@RequestBody @Valid LoginRequest req) {
        //LoginResponse - Это тип ответа. Spring возьмёт объект LoginResponse и превратит его в JSON.
                    // login(...) Имя метода (может быть любым, важны аннотации @PostMapping, которые снаружи).
                            // @RequestBody = “возьми JSON из тела запроса и собери объект LoginRequest”.
                            // LoginRequest — это DTO который лежит в файле LoginRequest.java и указываем,
                            //  что получаем от туда данные
                            // req = переменная, в которой лежат данные, которые ввёл пользователь.
                            // @Valid = перед запуском метода проверь валидацию, т.е. включить валидацию в DTO
        var user = userRepository.findByLogin(req.getLogin())
                .orElseThrow(() -> new RuntimeException("Invalid login or password"));
        // в переменную user записываем из БД черз userRepository ищем логин полученный из DTO
        
        // findByLogin("anton") ищет в БД, не просто логин, а возвращает весь User-объект, например:
        // user = User{
        //   id=5,
        //   login="anton",
        //   passwordHash="....",
        //   active=true,
        //   role=MANAGER,
        //   ...
        // }

        if (!user.isActive()) {
            throw new RuntimeException("User is inactive");
        } 
        //“Если пользователь НЕ активен — останови логин и выдай ошибку.”
        // if (условие) { ... } = “если условие истинно, выполнить код внутри { }
        // isActive() — метод, который возвращает boolean (true или false).

        if (!passwordEncoder.matches(req.getPassword(), user.getPasswordHash())) {
            throw new RuntimeException("Invalid login or password");
        }
        // LoginRequest — это DTO (данные, которые ввёл пользователь).
        // User — это Entity/модель из базы, не DTO

        String token = jwtService.generateAccessToken(new CustomUserDetails(user));  
        //CustomUserDetails(user) — это “обёртка” над User, чтобы привести его к формату, 
        // который удобно использовать в security / JWT.
        return new LoginResponse(token);
        // Это вызов твоего сервиса, который создаёт JWT токен.
        // JWT токен — это длинная строка вроде:
        // eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9....      
        // Внутри токена обычно “зашито” (в безопасном виде):
        // кто пользователь (например login или userId)
        // роли (например STAFF/MANAGER)
        // время жизни токена (когда истечёт)
        // подпись сервера (чтобы нельзя было подделать)
        // Важно: токен не хранит пароль.
        
    }
}

//Очень простая аналогия
// AuthController — это “окно кассира”
// login() — это “операция: принять логин/пароль и выдать пропуск”
// Spring — это “менеджер”, который направляет людей к нужному окну по адресу (URL)
