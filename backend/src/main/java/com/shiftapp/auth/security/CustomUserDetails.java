// CustomUserDetails — это ключевой класс, который “переводит” твоего User (из БД) на язык Spring Security.
// Зачем вообще нужен CustomUserDetails
// Spring Security работает не с твоей сущностью User, а с интерфейсом UserDetails.
// То есть Spring хочет видеть пользователя в таком виде:
// username (логин)
// password (хэш пароля)
// authorities (роли/права)
// enabled / locked / expired и т.д.
// Твой User — это Entity для базы, и у него свои поля.
// Поэтому есть “адаптер”: User → UserDetails.
package com.shiftapp.auth.security;

import com.shiftapp.users.User;
import com.shiftapp.users.UserRole;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails; //UserDetails — это интерфейс из Spring Security. Он “взят” не из твоего проекта, а из библиотеки Spring.
// То есть Spring говорит:
// “Мне не важно, как ты хранишь пользователя в БД. Дай мне объект, который умеет ответить на вопросы:”
// кто пользователь? (getUsername())
// какой у него пароль (хэш)? (getPassword())
// какие у него роли/права? (getAuthorities())
// он активен? (isEnabled())
// он заблокирован? (isAccountNonLocked()), и т.д.
// И вот этот “контракт” и есть UserDetails.

import java.util.Collection;
import java.util.List;

public class CustomUserDetails implements UserDetails {
    // этот класс обязан реализовать методы UserDetails
    // чтобы Spring Security мог его использовать как “пользователя”.

    private final User user;
    // Ты хранишь внутри оригинального пользователя из базы.
    // final → после создания объекта нельзя заменить user на другого.

    public CustomUserDetails(User user) {
        this.user = user;
    }

    public Long getUserId() { return user.getId(); }
    public Long getRestaurantId() { return user.getRestaurant().getId(); }
    public UserRole getRole() { return user.getRole(); }

    @Override  //“Я переопределяю метод, который обязателен по интерфейсу UserDetails”.
    public Collection<? extends GrantedAuthority> getAuthorities() {
        // Collection
        // Это “коллекция” (список/набор). Spring ожидает много прав, даже если у тебя всего одно.
        return List.of(new SimpleGrantedAuthority("ROLE_" + user.getRole().name()));
        //Ты собираешь строку:
        // "ROLE_" + "MANAGER" → "ROLE_MANAGER"
        // "ROLE_" + "STAFF" → "ROLE_STAFF"

        //List.of(...) создаёт список из одного элемента.
        // Почему список? Потому что Spring ожидает коллекцию прав. Даже если право одно.
        // Итого ты возвращаешь:
        // список из одного authority: ["ROLE_MANAGER"] или ["ROLE_STAFF"]
    }

    @Override
    public String getPassword() {return user.getPasswordHash();}

    @Override
    public String getUsername() {return user.getLogin();}

    @Override
    public boolean isAccountNonExpired() { return true; }

    @Override
    public boolean isAccountNonLocked() { return true; }

    @Override
    public boolean isCredentialsNonExpired() { return true; }

    @Override
    public boolean isEnabled() { return user.isActive(); }
}


//Простая аналогия
// User = “запись в базе” (как карточка клиента в архиве)
// UserDetails = “пропуск для охраны” (стандартный формат)
// CustomUserDetails = “переводчик, который делает пропуск из карточки”
// Охране не важно, как устроена карточка в архиве. Ей нужен пропуск стандартного вида.