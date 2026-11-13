<?php

namespace HiEvents\Services\Domain\Question;

use HiEvents\DomainObjects\AttendeeDomainObject;
use HiEvents\DomainObjects\Enums\QuestionBelongsTo;
use HiEvents\DomainObjects\Enums\QuestionPresetKey;
use HiEvents\DomainObjects\Enums\QuestionTypeEnum;
use HiEvents\DomainObjects\Generated\QuestionAnswerDomainObjectAbstract;
use HiEvents\DomainObjects\Generated\QuestionDomainObjectAbstract;
use HiEvents\DomainObjects\ProductDomainObject;
use HiEvents\DomainObjects\QuestionDomainObject;
use HiEvents\Repository\Interfaces\QuestionAnswerRepositoryInterface;
use HiEvents\Repository\Interfaces\QuestionRepositoryInterface;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Collection;
use Illuminate\Validation\ValidationException;

/**
 * A participant's own details in the participant form: the sensitive questions asked of each
 * ticket's attendee (date of birth, emergency contact, health, and any question the organizer
 * marked sensitive). They belong to the person, not to the ticket.
 */
class ParticipantDetailsService
{
    private const ANSWER_MAX_LENGTH = 255;

    private const ADDRESS_REQUIRED_FIELDS = ['address_line_1', 'city', 'state_or_region', 'zip_or_postal_code', 'country'];

    public function __construct(
        private readonly QuestionRepositoryInterface       $questionRepository,
        private readonly QuestionAnswerRepositoryInterface $questionAnswerRepository,
    )
    {
    }

    /**
     * @return Collection<int, QuestionDomainObject>
     */
    public function questions(int $eventId): Collection
    {
        return $this->questionRepository->findWhere([
            QuestionDomainObjectAbstract::EVENT_ID => $eventId,
            QuestionDomainObjectAbstract::BELONGS_TO => QuestionBelongsTo::PRODUCT->name,
            static fn(Builder $query) => $query
                ->where(QuestionDomainObjectAbstract::IS_SENSITIVE, true)
                ->orWhereNotNull(QuestionDomainObjectAbstract::PRESET_KEY),
        ]);
    }

    /**
     * The questions shown to this attendee: the ones of their ticket, as in the checkout.
     *
     * @return Collection<int, QuestionDomainObject>
     */
    public function questionsFor(AttendeeDomainObject $attendee): Collection
    {
        return $this->questionRepository
            ->loadRelation(ProductDomainObject::class)
            ->findWhere([
                QuestionDomainObjectAbstract::EVENT_ID => $attendee->getEventId(),
                QuestionDomainObjectAbstract::BELONGS_TO => QuestionBelongsTo::PRODUCT->name,
                QuestionDomainObjectAbstract::IS_HIDDEN => false,
                static fn(Builder $query) => $query
                    ->where(QuestionDomainObjectAbstract::IS_SENSITIVE, true)
                    ->orWhereNotNull(QuestionDomainObjectAbstract::PRESET_KEY),
            ])
            ->filter(fn(QuestionDomainObject $question) => $question->getProducts()
                ?->contains(fn(ProductDomainObject $product) => $product->getId() === $attendee->getProductId()))
            ->sortBy(fn(QuestionDomainObject $question) => $question->getOrder())
            ->values();
    }

    /**
     * Erases the attendee's answers: emptied first, as a deleted answer is only hidden.
     */
    public function eraseAnswers(AttendeeDomainObject $attendee): void
    {
        $questionIds = $this->questions($attendee->getEventId())
            ->map(fn(QuestionDomainObject $question) => $question->getId())
            ->values()
            ->all();

        if ($questionIds === []) {
            return;
        }

        $where = [
            QuestionAnswerDomainObjectAbstract::ATTENDEE_ID => $attendee->getId(),
            [QuestionAnswerDomainObjectAbstract::QUESTION_ID, 'in', $questionIds],
        ];

        $this->questionAnswerRepository->updateWhere([QuestionAnswerDomainObjectAbstract::ANSWER => null], $where);
        $this->questionAnswerRepository->deleteWhere($where);
    }

    /**
     * Records the attendee's answers, in the checkout's shape: questions: [{question_id, response}],
     * response: {answer} or the fields of an address. They replace what the attendee had answered.
     *
     * @param Collection<int, QuestionDomainObject> $questions
     * @throws ValidationException
     */
    public function saveAnswers(AttendeeDomainObject $attendee, Collection $questions, array $input): void
    {
        $responses = $this->responses($input);
        $errors = [];

        foreach ($questions->values() as $index => $question) {
            foreach ($this->errors($question, $responses[$question->getId()] ?? null) as $field => $error) {
                $errors["questions.$index.response.$field"] = $error;
            }
        }

        if ($errors) {
            throw ValidationException::withMessages($errors);
        }

        $this->eraseAnswers($attendee);

        foreach ($questions as $question) {
            $response = $responses[$question->getId()] ?? null;
            if ($this->isEmpty($question, $response)) {
                continue;
            }

            $this->questionAnswerRepository->create([
                QuestionAnswerDomainObjectAbstract::QUESTION_ID => $question->getId(),
                QuestionAnswerDomainObjectAbstract::ANSWER => $this->answer($question, $response),
                QuestionAnswerDomainObjectAbstract::ORDER_ID => $attendee->getOrderId(),
                QuestionAnswerDomainObjectAbstract::PRODUCT_ID => $attendee->getProductId(),
                QuestionAnswerDomainObjectAbstract::ATTENDEE_ID => $attendee->getId(),
            ]);
        }
    }

    /**
     * The date of birth given among these answers (Y-m-d), for the documents and the waiver.
     *
     * @param Collection<int, QuestionDomainObject> $questions
     */
    public function dateOfBirth(Collection $questions, array $input): ?string
    {
        $question = $questions->first(fn(QuestionDomainObject $question) => $question->getPresetKey() === QuestionPresetKey::DATE_OF_BIRTH->value);
        $answer = $question ? ($this->responses($input)[$question->getId()]['answer'] ?? null) : null;

        return is_string($answer) && $answer !== '' ? $answer : null;
    }

    /**
     * @return array<int, mixed> The responses by question id.
     */
    private function responses(array $input): array
    {
        $responses = [];

        foreach (is_array($input['questions'] ?? null) ? $input['questions'] : [] as $entry) {
            if (is_array($entry) && isset($entry['question_id'])) {
                $responses[(int)$entry['question_id']] = $entry['response'] ?? null;
            }
        }

        return $responses;
    }

    /**
     * @return array<string, string> By field of the response (answer, or an address field).
     */
    private function errors(QuestionDomainObject $question, mixed $response): array
    {
        if ($this->isEmpty($question, $response)) {
            return $question->getRequired() ? $this->requiredErrors($question, $response) : [];
        }

        if ($question->getType() === QuestionTypeEnum::ADDRESS->name) {
            $errors = $question->getRequired() ? $this->requiredErrors($question, $response) : [];
            foreach ($response as $field => $value) {
                if (is_string($value) && mb_strlen($value) > self::ANSWER_MAX_LENGTH) {
                    $errors[$field] = __('This field must be less than 255 characters.');
                }
            }

            return $errors;
        }

        $answer = $this->answer($question, $response);

        if (!$question->isAnswerValid($answer)) {
            return ['answer' => __('Please select an option')];
        }

        if (is_string($answer) && mb_strlen($answer) > self::ANSWER_MAX_LENGTH) {
            return ['answer' => __('This field must be less than 255 characters.')];
        }

        if (is_array($answer) && !$question->isPreDefinedChoice()) {
            return ['answer' => __('This field is required.')];
        }

        return [];
    }

    /**
     * @return array<string, string>
     */
    private function requiredErrors(QuestionDomainObject $question, mixed $response): array
    {
        if ($question->getType() !== QuestionTypeEnum::ADDRESS->name) {
            return ['answer' => __('This field is required.')];
        }

        $errors = [];
        foreach (self::ADDRESS_REQUIRED_FIELDS as $field) {
            if (!is_array($response) || trim((string)($response[$field] ?? '')) === '') {
                $errors[$field] = __('This field is required.');
            }
        }

        return $errors;
    }

    private function isEmpty(QuestionDomainObject $question, mixed $response): bool
    {
        if ($question->getType() === QuestionTypeEnum::ADDRESS->name) {
            return !is_array($response) || collect($response)->filter(fn($value) => is_string($value) && trim($value) !== '')->isEmpty();
        }

        $answer = $this->answer($question, $response);

        return $answer === null || $answer === '' || $answer === [];
    }

    private function answer(QuestionDomainObject $question, mixed $response): mixed
    {
        if ($question->getType() === QuestionTypeEnum::ADDRESS->name) {
            return $response;
        }

        $answer = is_array($response) && array_key_exists('answer', $response) ? $response['answer'] : $response;

        return is_string($answer) ? trim($answer) : $answer;
    }
}
