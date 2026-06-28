package com.englishcoach.api.repository;

import com.englishcoach.api.model.AiFeedback;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface AiFeedbackRepository extends JpaRepository<AiFeedback, UUID> {
    Optional<AiFeedback> findByMessageId(UUID messageId);
}
