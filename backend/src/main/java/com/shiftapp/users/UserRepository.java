package com.shiftapp.users;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;
import java.util.List;

public interface UserRepository extends JpaRepository<User, Long> {
    // Это интерфейс (не класс)
    Optional<User> findByLogin(String login);       //Это “найти пользователя по логину”.
    boolean existsByLogin(String login);            //Это “проверить существует ли пользователь с таким логином”.

    List<User> findByRestaurant_IdAndRoleOrderByFullNameAsc(Long restaurantId, UserRole role);
}

// extends JpaRepository<User, Long>
// Это значит:
// Ты работаешь с сущностью User (таблица пользователей в базе).
// Тип ID у User — Long (например id = 1, 2, 3...).

// ✅ save(user) — сохранить
// ✅ findById(id) — найти по id
// ✅ findAll() — найти всех
// ✅ deleteById(id) — удалить
// ✅ count() — количество записей
// и т.д.


// List<User> findByRestaurant_IdAndRoleOrderByFullNameAsc(Long restaurantId, UserRole role);
// Spring Data умеет читать имя метода и строить SQL запрос автоматически.
// Разберём по кускам:
// findBy ...
// значит: “найти по условиям”

// Restaurant_Id
// значит: “у пользователя есть поле restaurant, у ресторана есть id”
// То есть ты фильтруешь так: user.restaurant.id = restaurantId
// (Это работает если в User есть связь типа private Restaurant restaurant;)

// AndRole
// добавляет второе условие:
// user.role = role

// OrderByFullNameAsc
// сортировка:
// по fullName по возрастанию (A→Z)