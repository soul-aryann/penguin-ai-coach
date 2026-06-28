package com.englishcoach.api.repository;

import com.englishcoach.api.model.Message;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface MessageRepository extends JpaRepository<Message, UUID> {

    // Safely look up message history for a specific conversation verifying user ownership
    @Query("SELECT m FROM Message m JOIN m.conversation c WHERE c.id = :conversationId AND c.user.id = :userId ORDER BY m.createdAt ASC")
    List<Message> findAllByConversationIdAndUserId(@Param("conversationId") UUID conversationId, @Param("userId") UUID userId);
}
