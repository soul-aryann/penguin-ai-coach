package com.englishcoach.api.repository;

import com.englishcoach.api.model.Conversation;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface ConversationRepository extends JpaRepository<Conversation, UUID> {

    // Explicitly filter conversation lists by user_id
    List<Conversation> findAllByUserIdOrderByCreatedAtDesc(UUID userId);

    // Safely look up a single conversation verifying ownership
    @Query("SELECT c FROM Conversation c WHERE c.id = :id AND c.user.id = :userId")
    Optional<Conversation> findByIdAndUserId(@Param("id") UUID id, @Param("userId") UUID userId);
}
