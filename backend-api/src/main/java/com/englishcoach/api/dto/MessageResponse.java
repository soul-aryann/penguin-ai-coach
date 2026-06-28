package com.englishcoach.api.dto;

import com.englishcoach.api.model.Role;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class MessageResponse {
    private UUID id;
    private Role role;
    private String transcript;
    private Instant createdAt;
    private FeedbackResponse feedback;
}
