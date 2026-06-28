package com.englishcoach.api.dto;

import com.englishcoach.api.model.AiFeedback;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class FeedbackResponse {
    private List<AiFeedback.GrammarCorrection> grammarCorrections;
    private Integer pronunciationScore;
    private String pronunciationFeedback;
    private String vocabularyTips;
}
