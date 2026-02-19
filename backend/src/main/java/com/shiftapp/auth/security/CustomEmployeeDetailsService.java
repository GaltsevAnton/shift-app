package com.shiftapp.auth.security;

import com.shiftapp.employees.EmployeeRepository;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;

@Service
public class CustomEmployeeDetailsService implements UserDetailsService {

    private final EmployeeRepository employeeRepository;

    public CustomEmployeeDetailsService(EmployeeRepository employeeRepository) {
        this.employeeRepository = employeeRepository;
    }

    @Override
    public UserDetails loadUserByUsername(String username) throws UsernameNotFoundException {
        var emp = employeeRepository.findByLogin(username)
                .orElseThrow(() -> new UsernameNotFoundException("Employee not found: " + username));
        return new CustomEmployeeDetails(emp);
    }
}
