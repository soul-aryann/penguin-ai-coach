package com.englishcoach.api.service;

import com.englishcoach.api.model.AiFeedback;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;
import org.springframework.web.util.UriComponentsBuilder;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.util.*;

@Service
@RequiredArgsConstructor
public class GeminiService {

    private final ConversationService conversationService;
    private final ObjectMapper objectMapper;
    private final RestClient restClient = RestClient.builder().build();

    @Value("${gemini.api.key}")
    private String apiKey;

    public void processVoiceMessageSynchronously(UUID userId, UUID conversationId, byte[] audioBytes, String contentType) {
        String urlString = "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=" + apiKey;
        java.net.URI uri = java.net.URI.create(urlString);

        Map<String, Object> payload = buildPayload(audioBytes, contentType);

        int maxRetries = 3;
        int attempt = 0;
        long backoffMs = 2000;
        String responseBody = null;

        while (true) {
            try {
                responseBody = restClient.post()
                        .uri(uri)
                        .contentType(MediaType.APPLICATION_JSON)
                        .body(payload)
                        .retrieve()
                        .body(String.class);
                break;
            } catch (org.springframework.web.client.RestClientResponseException e) {
                if (e.getStatusCode().value() == 503 && attempt < maxRetries) {
                    attempt++;
                    System.err.println(">>> Gemini API returned 503 Service Unavailable. Retrying attempt " + attempt + " of " + maxRetries + " after " + backoffMs + "ms...");
                    try {
                        Thread.sleep(backoffMs);
                    } catch (InterruptedException ie) {
                        Thread.currentThread().interrupt();
                        throw new RuntimeException("Retry interrupted", ie);
                    }
                    backoffMs *= 2;
                } else {
                    throw e;
                }
            }
        }

        try {
            JsonNode responseJson = objectMapper.readTree(responseBody);
            JsonNode textNode = responseJson.at("/candidates/0/content/parts/0/text");
            if (!textNode.isTextual()) {
                throw new IllegalStateException("Gemini response did not contain text content. Raw response: " + responseBody);
            }

            String text = textNode.asText();
            JsonNode feedbackNode = objectMapper.readTree(text);

            String userTranscript = feedbackNode.path("user_transcript").asText();
            List<AiFeedback.GrammarCorrection> corrections = objectMapper.convertValue(
                    feedbackNode.path("grammar_corrections"),
                    objectMapper.getTypeFactory().constructCollectionType(List.class, AiFeedback.GrammarCorrection.class)
            );

            Integer pronunciationScore = feedbackNode.path("pronunciation_score").asInt();
            String pronunciationFeedback = feedbackNode.path("pronunciation_feedback").asText();
            String vocabularyTips = feedbackNode.path("vocabulary_tips").asText();
            String assistantResponse = feedbackNode.path("assistant_response").asText();

            conversationService.saveConversationTurn(
                    userId, conversationId, userTranscript, corrections,
                    pronunciationScore, pronunciationFeedback, vocabularyTips, assistantResponse
            );

        } catch (Exception e) {
            System.err.println(">>> ERROR PROCESSING GEMINI RESPONSE: " + e.getMessage());
            e.printStackTrace();
            throw new RuntimeException("Failed to process voice message: " + e.getMessage(), e);
        }
    }

    private void processGeminiChunk(String chunk, StringBuilder jsonBuffer,
                                    boolean[] userTranscriptSent, boolean[] grammarFeedbackSent,
                                    int[] valueStartIndex, StringBuilder streamedAssistantResponse,
                                    SseEmitter emitter) {
        jsonBuffer.append(chunk);

        // 1. Check for user_transcript
        if (!userTranscriptSent[0]) {
            int grammarIdx = jsonBuffer.indexOf("\"grammar_corrections\"");
            if (grammarIdx != -1) {
                try {
                    String sub = jsonBuffer.substring(0, grammarIdx).trim();
                    if (sub.endsWith(",")) {
                        sub = sub.substring(0, sub.length() - 1).trim();
                    }
                    sub = sub + "}";
                    JsonNode rootNode = objectMapper.readTree(sub);
                    String transcript = rootNode.path("user_transcript").asText();
                    if (transcript != null && !transcript.isEmpty()) {
                        emitter.send(SseEmitter.event()
                                .name("user_transcript")
                                .data(Map.of("transcript", transcript)));
                        userTranscriptSent[0] = true;
                    }
                } catch (Exception e) {
                    // Ignore, wait for more data
                }
            }
        }

        // 2. Check for grammar_feedback
        if (!grammarFeedbackSent[0]) {
            int assistantIdx = jsonBuffer.indexOf("\"assistant_response\"");
            if (assistantIdx != -1) {
                try {
                    String sub = jsonBuffer.substring(0, assistantIdx).trim();
                    if (sub.endsWith(",")) {
                        sub = sub.substring(0, sub.length() - 1).trim();
                    }
                    sub = sub + "}";

                    JsonNode rootNode = objectMapper.readTree(sub);

                    Map<String, Object> feedbackEvent = new LinkedHashMap<>();
                    feedbackEvent.put("grammarCorrections", objectMapper.convertValue(
                            rootNode.path("grammar_corrections"), List.class));
                    feedbackEvent.put("pronunciationScore", rootNode.path("pronunciation_score").asInt());
                    feedbackEvent.put("pronunciationFeedback", rootNode.path("pronunciation_feedback").asText());
                    feedbackEvent.put("vocabularyTips", rootNode.path("vocabulary_tips").asText());

                    emitter.send(SseEmitter.event()
                            .name("grammar_feedback")
                            .data(feedbackEvent));
                    grammarFeedbackSent[0] = true;
                } catch (Exception e) {
                    // Ignore, wait for more data
                }
            }
        }

        // 3. Stream assistant_response_chunk
        if (grammarFeedbackSent[0]) {
            if (valueStartIndex[0] == -1) {
                int keyIdx = jsonBuffer.indexOf("\"assistant_response\"");
                if (keyIdx != -1) {
                    int colonIdx = jsonBuffer.indexOf(":", keyIdx);
                    if (colonIdx != -1) {
                        int quoteIdx = jsonBuffer.indexOf("\"", colonIdx);
                        if (quoteIdx != -1) {
                            valueStartIndex[0] = quoteIdx + 1;
                        }
                    }
                }
            }

            if (valueStartIndex[0] != -1) {
                String partialText = jsonBuffer.substring(valueStartIndex[0]);

                int endQuoteIdx = -1;
                boolean escaped = false;
                for (int i = 0; i < partialText.length(); i++) {
                    char c = partialText.charAt(i);
                    if (c == '\\') {
                        escaped = !escaped;
                    } else if (c == '"' && !escaped) {
                        endQuoteIdx = i;
                        break;
                    } else {
                        escaped = false;
                    }
                }

                String stringToDecode;
                if (endQuoteIdx != -1) {
                    stringToDecode = partialText.substring(0, endQuoteIdx);
                } else {
                    stringToDecode = partialText;
                    int backslashCount = 0;
                    for (int i = stringToDecode.length() - 1; i >= 0; i--) {
                        if (stringToDecode.charAt(i) == '\\') {
                            backslashCount++;
                        } else {
                            break;
                        }
                    }
                    if (backslashCount % 2 != 0) {
                        stringToDecode = stringToDecode.substring(0, stringToDecode.length() - 1);
                    }
                }

                try {
                    String jsonStr = "{\"text\": \"" + stringToDecode + "\"}";
                    JsonNode tempNode = objectMapper.readTree(jsonStr);
                    String decoded = tempNode.path("text").asText();
                    if (decoded != null && decoded.length() > streamedAssistantResponse.length()) {
                        String newChunk = decoded.substring(streamedAssistantResponse.length());
                        emitter.send(SseEmitter.event()
                                .name("assistant_response_chunk")
                                .data(Map.of("chunk", newChunk)));
                        streamedAssistantResponse.append(newChunk);
                    }
                } catch (Exception e) {
                    // Ignore, parsing will succeed when more data completes the token
                }
            }
        }
    }

    private void finalizeConversationTurn(UUID userId, UUID conversationId, String finalJson, String streamedResponse, SseEmitter emitter) {
        try {
            JsonNode rootNode = objectMapper.readTree(finalJson);

            String userTranscript = rootNode.path("user_transcript").asText();

            List<AiFeedback.GrammarCorrection> corrections = objectMapper.convertValue(
                    rootNode.path("grammar_corrections"),
                    objectMapper.getTypeFactory().constructCollectionType(List.class, AiFeedback.GrammarCorrection.class)
            );

            Integer pronunciationScore = rootNode.path("pronunciation_score").asInt();
            String pronunciationFeedback = rootNode.path("pronunciation_feedback").asText();
            String vocabularyTips = rootNode.path("vocabulary_tips").asText();
            String assistantResponse = rootNode.path("assistant_response").asText();

            if (assistantResponse == null || assistantResponse.isEmpty()) {
                assistantResponse = streamedResponse;
            }

            if (assistantResponse != null && assistantResponse.length() > streamedResponse.length()) {
                String remainingChunk = assistantResponse.substring(streamedResponse.length());
                emitter.send(SseEmitter.event()
                        .name("assistant_response_chunk")
                        .data(Map.of("chunk", remainingChunk)));
            }

            ConversationService.SaveResult saveResult = conversationService.saveConversationTurn(
                    userId, conversationId, userTranscript, corrections,
                    pronunciationScore, pronunciationFeedback, vocabularyTips, assistantResponse
            );

            emitter.send(SseEmitter.event()
                    .name("done")
                    .data(Map.of(
                            "userMessageId", saveResult.userMessageId(),
                            "assistantMessageId", saveResult.assistantMessageId()
                    )));

            emitter.complete();
        } catch (Exception e) {
            try {
                emitter.send(SseEmitter.event().name("error").data("Failed to finalize transaction: " + e.getMessage()));
            } catch (Exception ignored) {}
            emitter.completeWithError(e);
        }
    }

    private Map<String, Object> buildPayload(byte[] audioBytes, String contentType) {
        Map<String, Object> request = new LinkedHashMap<>();

        // systemInstruction
        Map<String, Object> systemInstruction = new LinkedHashMap<>();
        systemInstruction.put("parts", List.of(Map.of("text",
                "You are an expert English language coach. You are talking to a student learning English.\n" +
                "You will receive an audio file of the student speaking.\n" +
                "Your task is to:\n" +
                "1. Transcribe the audio exactly.\n" +
                "2. Analyze the grammar, sentence structure, and word choices. Identify errors and explain them concisely.\n" +
                "3. Assess the pronunciation/intonation based on the clarity of speech in the audio.\n" +
                "4. Formulate a natural, encouraging conversational response that replies directly to the student's statement and prompts them to continue talking. Keep your conversational response relatively concise (2-3 sentences max) so it is ideal for text-to-speech feedback."
        )));
        request.put("systemInstruction", systemInstruction);

        // contents
        Map<String, Object> textPart = new LinkedHashMap<>();
        textPart.put("text", "Please analyze this spoken audio according to the system instructions.");

        Map<String, Object> audioPart = new LinkedHashMap<>();
        Map<String, Object> inlineData = new LinkedHashMap<>();
        inlineData.put("mime_type", contentType);
        inlineData.put("data", Base64.getEncoder().encodeToString(audioBytes));
        audioPart.put("inline_data", inlineData);

        Map<String, Object> content = new LinkedHashMap<>();
        content.put("parts", List.of(textPart, audioPart));
        request.put("contents", List.of(content));

        // generationConfig
        Map<String, Object> generationConfig = new LinkedHashMap<>();
        generationConfig.put("responseMimeType", "application/json");

        Map<String, Object> responseSchema = new LinkedHashMap<>();
        responseSchema.put("type", "OBJECT");

        Map<String, Object> properties = new LinkedHashMap<>();
        properties.put("user_transcript", Map.of("type", "STRING"));

        Map<String, Object> grammarCorrections = new LinkedHashMap<>();
        grammarCorrections.put("type", "ARRAY");
        Map<String, Object> correctionItem = new LinkedHashMap<>();
        correctionItem.put("type", "OBJECT");
        correctionItem.put("properties", Map.of(
                "original", Map.of("type", "STRING"),
                "correction", Map.of("type", "STRING"),
                "explanation", Map.of("type", "STRING")
        ));
        correctionItem.put("required", List.of("original", "correction", "explanation"));
        grammarCorrections.put("items", correctionItem);
        properties.put("grammar_corrections", grammarCorrections);

        properties.put("pronunciation_score", Map.of("type", "INTEGER"));
        properties.put("pronunciation_feedback", Map.of("type", "STRING"));
        properties.put("vocabulary_tips", Map.of("type", "STRING"));
        properties.put("assistant_response", Map.of("type", "STRING"));

        responseSchema.put("properties", properties);
        responseSchema.put("required", List.of(
                "user_transcript",
                "grammar_corrections",
                "pronunciation_score",
                "pronunciation_feedback",
                "vocabulary_tips",
                "assistant_response"
        ));

        generationConfig.put("responseSchema", responseSchema);
        request.put("generationConfig", generationConfig);

        return request;
    }
}
