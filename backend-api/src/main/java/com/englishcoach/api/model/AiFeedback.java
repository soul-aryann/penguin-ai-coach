package com.englishcoach.api.model;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Entity
@Table(name = "ai_feedback")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AiFeedback {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @OneToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "message_id", nullable = false, unique = true)
    private Message message;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "grammar_corrections", columnDefinition = "jsonb")
    private List<GrammarCorrection> grammarCorrections;

    @Column(name = "pronunciation_score")
    private Integer pronunciationScore;

    @Column(name = "pronunciation_feedback", columnDefinition = "TEXT")
    private String pronunciationFeedback;

    @Column(name = "vocabulary_tips", columnDefinition = "TEXT")
    private String vocabularyTips;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class GrammarCorrection {
        private String original;
        private String correction;
        private String explanation;
    }
}
