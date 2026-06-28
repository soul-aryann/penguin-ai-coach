package com.englishcoach.api.service;

import com.englishcoach.api.dto.*;
import com.englishcoach.api.model.*;
import com.englishcoach.api.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class ConversationService {

    private final ConversationRepository conversationRepository;
    private final MessageRepository messageRepository;
    private final AiFeedbackRepository aiFeedbackRepository;
    private final UserRepository userRepository;

    @Transactional(readOnly = true)
    public List<ConversationResponse> getConversations(UUID userId) {
        return conversationRepository.findAllByUserIdOrderByCreatedAtDesc(userId)
                .stream()
                .map(c -> ConversationResponse.builder()
                        .id(c.getId())
                        .title(c.getTitle())
                        .createdAt(c.getCreatedAt())
                        .build())
                .collect(Collectors.toList());
    }

    @Transactional
    public ConversationResponse createConversation(UUID userId, CreateConversationRequest request) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));

        Conversation conversation = Conversation.builder()
                .user(user)
                .title(request.getTitle())
                .build();

        Conversation saved = conversationRepository.save(conversation);

        return ConversationResponse.builder()
                .id(saved.getId())
                .title(saved.getTitle())
                .createdAt(saved.getCreatedAt())
                .build();
    }

    @Transactional(readOnly = true)
    public ConversationHistoryResponse getConversationHistory(UUID conversationId, UUID userId) {
        // Enforce application-level isolation by verifying the conversation ownership
        Conversation conversation = conversationRepository.findByIdAndUserId(conversationId, userId)
                .orElseThrow(() -> new IllegalArgumentException("Conversation not found or access denied"));

        // Fetch messages for this conversation, verifying user ownership
        List<Message> messages = messageRepository.findAllByConversationIdAndUserId(conversationId, userId);

        List<MessageResponse> messageResponses = messages.stream().map(m -> {
            FeedbackResponse feedbackResponse = null;
            if (m.getRole() == Role.USER) {
                Optional<AiFeedback> feedbackOpt = aiFeedbackRepository.findByMessageId(m.getId());
                if (feedbackOpt.isPresent()) {
                    AiFeedback fb = feedbackOpt.get();
                    feedbackResponse = FeedbackResponse.builder()
                            .grammarCorrections(fb.getGrammarCorrections())
                            .pronunciationScore(fb.getPronunciationScore())
                            .pronunciationFeedback(fb.getPronunciationFeedback())
                            .vocabularyTips(fb.getVocabularyTips())
                            .build();
                }
            }

            return MessageResponse.builder()
                    .id(m.getId())
                    .role(m.getRole())
                    .transcript(m.getTranscript())
                    .createdAt(m.getCreatedAt())
                    .feedback(feedbackResponse)
                    .build();
        }).collect(Collectors.toList());

        return ConversationHistoryResponse.builder()
                .id(conversation.getId())
                .title(conversation.getTitle())
                .messages(messageResponses)
                .build();
    }

    @Transactional
    public SaveResult saveConversationTurn(UUID userId, UUID conversationId, String userTranscript,
                                          List<AiFeedback.GrammarCorrection> corrections,
                                          Integer pronunciationScore, String pronunciationFeedback,
                                          String vocabularyTips, String assistantResponseText) {

        // 1. Fetch user reference
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));

        // 2. Fetch conversation with ownership verification
        Conversation conversation = conversationRepository.findByIdAndUserId(conversationId, userId)
                .orElseThrow(() -> new IllegalArgumentException("Conversation not found or access denied"));

        // 3. Save User Message
        Message userMessage = Message.builder()
                .conversation(conversation)
                .user(user)
                .role(Role.USER)
                .transcript(userTranscript)
                .build();
        Message savedUserMessage = messageRepository.save(userMessage);

        // 4. Save AI Feedback
        AiFeedback feedback = AiFeedback.builder()
                .message(savedUserMessage)
                .grammarCorrections(corrections)
                .pronunciationScore(pronunciationScore)
                .pronunciationFeedback(pronunciationFeedback)
                .vocabularyTips(vocabularyTips)
                .build();
        aiFeedbackRepository.save(feedback);

        // 5. Save Assistant Message
        Message assistantMessage = Message.builder()
                .conversation(conversation)
                .user(user)
                .role(Role.ASSISTANT)
                .transcript(assistantResponseText)
                .build();
        Message savedAssistantMessage = messageRepository.save(assistantMessage);

        return new SaveResult(savedUserMessage.getId(), savedAssistantMessage.getId());
    }

    @Transactional
    public void deleteConversation(UUID conversationId, UUID userId) {
        Conversation conversation = conversationRepository.findByIdAndUserId(conversationId, userId)
                .orElseThrow(() -> new IllegalArgumentException("Conversation not found or access denied"));
        conversationRepository.delete(conversation);
    }

    public record SaveResult(UUID userMessageId, UUID assistantMessageId) {}
}
