package com.englishcoach.api.controller;

import com.englishcoach.api.dto.*;
import com.englishcoach.api.model.User;
import com.englishcoach.api.service.ConversationService;
import com.englishcoach.api.service.GeminiService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.io.IOException;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/conversations")
@RequiredArgsConstructor
public class ConversationController {

    private final ConversationService conversationService;
    private final GeminiService geminiService;

    @GetMapping
    public ResponseEntity<List<ConversationResponse>> getConversations() {
        UUID userId = getAuthenticatedUserId();
        List<ConversationResponse> conversations = conversationService.getConversations(userId);
        return ResponseEntity.ok(conversations);
    }

    @PostMapping
    public ResponseEntity<ConversationResponse> createConversation(@Valid @RequestBody CreateConversationRequest request) {
        UUID userId = getAuthenticatedUserId();
        ConversationResponse response = conversationService.createConversation(userId, request);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @GetMapping("/{conversationId}")
    public ResponseEntity<ConversationHistoryResponse> getConversationHistory(@PathVariable UUID conversationId) {
        UUID userId = getAuthenticatedUserId();
        ConversationHistoryResponse history = conversationService.getConversationHistory(conversationId, userId);
        return ResponseEntity.ok(history);
    }

    @PostMapping(value = "/{conversationId}/messages", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<ConversationHistoryResponse> sendMessage(
            @PathVariable UUID conversationId,
            @RequestParam("audio") MultipartFile audio) {
        System.out.println(">>> CONTROLLER HIT: Received audio file size: " + (audio != null ? audio.getSize() : 0) + " bytes");

        // 1. Eager Bytes Extraction on Main Thread
        if (audio == null || audio.isEmpty()) {
            throw new IllegalArgumentException("Audio file is required");
        }

        byte[] audioBytes;
        try {
            audioBytes = audio.getBytes();
        } catch (IOException e) {
            throw new RuntimeException("Failed to read audio bytes in memory: " + e.getMessage());
        }

        UUID userId = getAuthenticatedUserId();

        // Limit size to maximum of 10MB
        if (audio.getSize() > 10 * 1024 * 1024) {
            throw new IllegalArgumentException("Audio file size exceeds the maximum limit of 10MB");
        }

        String contentType = audio.getContentType();
        if (contentType == null) {
            throw new IllegalArgumentException("Content-Type header is missing");
        }

        // Extract base MIME type (e.g. audio/webm;codecs=opus -> audio/webm)
        String mimeType = contentType.split(";")[0].trim().toLowerCase();
        List<String> allowedMimeTypes = List.of("audio/webm", "audio/wav", "audio/ogg", "audio/mp3", "audio/m4a", "audio/x-m4a");
        if (!allowedMimeTypes.contains(mimeType)) {
            throw new IllegalArgumentException("Unsupported audio format: " + mimeType);
        }

        // 2. Perform background processing synchronously
        geminiService.processVoiceMessageSynchronously(userId, conversationId, audioBytes, mimeType);

        // 3. Return updated conversation history
        ConversationHistoryResponse history = conversationService.getConversationHistory(conversationId, userId);
        return ResponseEntity.ok(history);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteConversation(@PathVariable UUID id) {
        UUID userId = getAuthenticatedUserId();
        conversationService.deleteConversation(id, userId);
        return ResponseEntity.noContent().build();
    }

    private UUID getAuthenticatedUserId() {
        Object principal = SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        if (principal instanceof User) {
            return ((User) principal).getId();
        }
        throw new IllegalStateException("Authenticated user principal not found or invalid type");
    }

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<Map<String, String>> handleIllegalArgumentException(IllegalArgumentException e) {
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("error", e.getMessage()));
    }

    @ExceptionHandler(RuntimeException.class)
    public ResponseEntity<Map<String, String>> handleRuntimeException(RuntimeException e) {
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(Map.of("error", e.getMessage()));
    }
}
