package com.amazonaws.kvstranscribestreaming;

import java.util.Optional;
import software.amazon.awssdk.services.transcribestreaming.model.LanguageCode;
import software.amazon.awssdk.services.transcribestreaming.model.Specialty;
import software.amazon.awssdk.services.transcribestreaming.model.VocabularyFilterMethod;

/**
 * <p>Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.</p>
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy of this
 * software and associated documentation files (the "Software"), to deal in the Software
 * without restriction, including without limitation the rights to use, copy, modify,
 * merge, publish, distribute, sublicense, and/or sell copies of the Software, and to
 * permit persons to whom the Software is furnished to do so.
 * <p>
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED,
 * INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A
 * PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT
 * HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION
 * OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
 * SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 *
 */
public class TranscriptionRequest {
    String streamARN = null;
    String startFragmentNum = null;
    long audioStartTimestamp = 0;
    String customerPhoneNumber = null;
    String voiceCallId = null;
    Optional<String> languageCode = Optional.empty();
    boolean streamAudioFromCustomer = true;
    boolean streamAudioToCustomer = true;
    String instanceARN = null;
    String engine = "standard";
    Optional<String> vocabularyName = Optional.empty();
    Optional<String> vocabularyFilterName = Optional.empty();
    Optional<String> vocabularyFilterMethod = Optional.empty();
    Optional<String> specialty = Optional.empty();

    public String getStreamARN() {
        return this.streamARN;
    }

    public void setStreamARN(String streamARN) {
        this.streamARN = streamARN;
    }

    public String getStartFragmentNum() {
        return this.startFragmentNum;
    }

    public void setStartFragmentNum(String startFragmentNum) {
        this.startFragmentNum = startFragmentNum;
    }

    public long getAudioStartTimestamp() {
        return this.audioStartTimestamp;
    }

    public void setAudioStartTimestamp(String audioStartTimestampStr) {
        this.audioStartTimestamp = Long.decode(audioStartTimestampStr);
    }

    public String getCustomerPhoneNumber() {
        return this.customerPhoneNumber;
    }

    public void setCustomerPhoneNumber(String customerPhoneNumber) {
        this.customerPhoneNumber = customerPhoneNumber;
    }

    public String getVoiceCallId() {
        return this.voiceCallId;
    }

    public void setVoiceCallId(String voiceCallId) {
        this.voiceCallId = voiceCallId;
    }

    public Optional<String> getLanguageCode() {
        return this.languageCode;
    }

    public void setLanguageCode(String languageCode) {
        if ((languageCode != null) && (languageCode.length() > 0)) {
            this.languageCode = Optional.of(languageCode);
        }
    }

    public String getInstanceARN() {
        return this.instanceARN;
    }

    public void setInstanceARN(String instanceARN) {
        this.instanceARN = instanceARN;
    }

    public boolean isStreamAudioFromCustomer() {
        return this.streamAudioFromCustomer;
    }

    public void setStreamAudioFromCustomer(boolean enabled) {
        this.streamAudioFromCustomer = enabled;
    }

    public boolean isStreamAudioToCustomer() {
        return this.streamAudioToCustomer;
    }

    public void setStreamAudioToCustomer(boolean enabled) {
        this.streamAudioToCustomer = enabled;
    }

    public String getEngine() {
        return this.engine;
    }

    public void setEngine(String engine) {
        this.engine = engine.toLowerCase(); // lowercase to avoid errors later on
    }

    public Optional<String> getVocabularyName() {
        return this.vocabularyName;
    }

    public void setVocabularyName(String vocabularyName) {
        if ((vocabularyName != null) && (vocabularyName.length() > 0)) {
            this.vocabularyName = Optional.of(vocabularyName);
        }
    }

    public Optional<String> getVocabularyFilterName() {
        return this.vocabularyFilterName;
    }

    public void setVocabularyFilterName(String vocabularyFilterName) {
        if ((vocabularyFilterName != null) && (vocabularyFilterName.length() > 0)) {
            this.vocabularyFilterName = Optional.of(vocabularyFilterName);
        }
    }

    public Optional<String> getVocabularyFilterMethod() {
        return this.vocabularyFilterMethod;
    }

    public void setVocabularyFilterMethod(String vocabularyFilterMethod) {
        if ((vocabularyFilterMethod != null) && (vocabularyFilterMethod.length() > 0)) {
            this.vocabularyFilterMethod = Optional.of(vocabularyFilterMethod.toLowerCase()); // lowercase to avoid errors later on
        }
    }

    public Optional<String> getSpecialty() {
        return this.specialty;
    }

    public void setSpecialty(String specialty) {
        if ((specialty != null) && (specialty.length() > 0)) {
            this.specialty = Optional.of(specialty);
        }
    }

    public String toString() {
        return String.format("streamARN=%s, startFragmentNum=%s, voiceCallId=%s, languageCode=%s, audioStartTimestamp=%s, streamAudioFromCustomer=%s, streamAudioToCustomer=%s, engine=%s, vocabularyName=%s, vocabularyFilterName=%s, vocabularyFilterMethod=%s, specialty=%s",
                getStreamARN(), getStartFragmentNum(), getVoiceCallId(), getLanguageCode(), getAudioStartTimestamp(), isStreamAudioFromCustomer(), isStreamAudioToCustomer(), getEngine(), getVocabularyName(), getVocabularyFilterName(), getVocabularyFilterMethod(), getSpecialty());
    }

    public void validate() throws IllegalArgumentException {
        // acceptable values: https://docs.aws.amazon.com/transcribe/latest/dg/API_streaming_StartStreamTranscription.html#API_streaming_StartStreamTranscription_RequestParameters
        if (languageCode.isPresent() && !LanguageCode.knownValues().contains(LanguageCode.fromValue(languageCode.get()))) {
            throw new IllegalArgumentException("Language code " + languageCode.get() + " is invalid!");
        }

        // acceptable values: https://docs.aws.amazon.com/transcribe/latest/dg/streaming-filter-unwanted.html
        if (vocabularyFilterMethod.isPresent() && !VocabularyFilterMethod.knownValues().contains(VocabularyFilterMethod.fromValue(vocabularyFilterMethod.get()))) {
            throw new IllegalArgumentException("Vocabulary filter method " + vocabularyFilterMethod.get() + " is invalid!");
        }

        // acceptable values: https://sdk.amazonaws.com/java/api/latest/software/amazon/awssdk/services/transcribestreaming/model/Specialty.html
        if (specialty.isPresent() && !Specialty.knownValues().contains(Specialty.fromValue(specialty.get()))) {
            throw new IllegalArgumentException("Specialty " + specialty.get() + " is invalid!");
        }
    }
}
