<?php

namespace HiEvents\Validators\Rules;

use Closure;
use HiEvents\DomainObjects\Enums\ProductType;
use HiEvents\DomainObjects\EventDomainObject;
use HiEvents\DomainObjects\ProductDomainObject;
use HiEvents\Services\Domain\Waiver\WaiverService;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Contracts\Validation\ValidatorAwareRule;
use Illuminate\Support\Collection;
use Illuminate\Validation\Validator;

/**
 * Every ticket's attendee accepts the event's waiver and signs it with their
 * full name; under WaiverService::ADULT_AGE on the event's day (from the
 * participant form's date of birth), a parent or guardian signs too. The
 * errors land on each attendee's own fields (products.N.waiver.*).
 */
class ProductWaiverRule implements ValidationRule, ValidatorAwareRule
{
    private const NAME_MAX_LENGTH = 100;

    private Validator $validator;

    /**
     * @param Collection<int, ProductDomainObject> $products
     */
    public function __construct(
        private readonly Collection        $products,
        private readonly EventDomainObject $event,
        private readonly ?int              $dateOfBirthQuestionId,
        private readonly WaiverService     $waiverService,
    )
    {
    }

    public function setValidator(Validator $validator): static
    {
        $this->validator = $validator;

        return $this;
    }

    public function validate(string $attribute, mixed $value, Closure $fail): void
    {
        $messages = [];

        foreach ((array)$value as $index => $attendee) {
            if (!is_array($attendee) || !$this->isTicket($attendee['product_id'] ?? null)) {
                continue;
            }

            $waiver = is_array($attendee['waiver'] ?? null) ? $attendee['waiver'] : [];
            $key = "products.$index.waiver";

            if (!filter_var($waiver['accepted'] ?? false, FILTER_VALIDATE_BOOLEAN)) {
                $messages["$key.accepted"][] = __('Please accept the waiver.');
            }

            $nameError = $this->nameError($waiver['signed_name'] ?? null, __('Type your full name to sign the waiver.'));
            if ($nameError) {
                $messages["$key.signed_name"][] = $nameError;
            }

            if ($this->waiverService->isMinorOnEventDay($this->dateOfBirth($attendee), $this->event)) {
                $guardianError = $this->nameError($waiver['guardian_name'] ?? null, __('A parent or guardian must sign for a participant under :age.', [
                    'age' => WaiverService::ADULT_AGE,
                ]));
                if ($guardianError) {
                    $messages["$key.guardian_name"][] = $guardianError;
                }
            }
        }

        if ($messages) {
            $this->validator->messages()->merge($messages);
        }
    }

    private function nameError(mixed $name, string $missingMessage): ?string
    {
        $name = trim((string)$name);

        if ($name === '') {
            return $missingMessage;
        }

        if (mb_strlen($name) > self::NAME_MAX_LENGTH) {
            return __('The name must be :max characters or less.', ['max' => self::NAME_MAX_LENGTH]);
        }

        return null;
    }

    private function dateOfBirth(array $attendee): ?string
    {
        if ($this->dateOfBirthQuestionId === null) {
            return null;
        }

        foreach ($attendee['questions'] ?? [] as $question) {
            if ((int)($question['question_id'] ?? 0) === $this->dateOfBirthQuestionId) {
                $response = $question['response'] ?? null;
                $answer = is_array($response) ? ($response['answer'] ?? null) : $response;

                return is_string($answer) ? $answer : null;
            }
        }

        return null;
    }

    private function isTicket(mixed $productId): bool
    {
        return $this->products->contains(
            fn(ProductDomainObject $product) => $product->getId() === (int)$productId
                && $product->getProductType() === ProductType::TICKET->name
        );
    }
}
