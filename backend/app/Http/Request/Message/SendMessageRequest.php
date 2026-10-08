<?php

namespace HiEvents\Http\Request\Message;

use HiEvents\DomainObjects\Enums\MessageTypeEnum;
use HiEvents\DomainObjects\Status\OrderStatus;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Http\UploadedFile;
use Illuminate\Validation\Validator;
use Illuminate\Validation\Rules\In;

class SendMessageRequest extends FormRequest
{
    public const MAX_ATTACHMENTS = 5;
    public const MAX_TOTAL_ATTACHMENT_SIZE_KB = 10240;

    public function rules(): array
    {
        return [
            'subject' => 'required|string|max:100',
            'message' => 'required|string|max:8000',
            'message_type' => [new In(MessageTypeEnum::valuesArray()), 'required'],
            'is_test' => 'boolean',
            'attendee_ids' => 'max:50,array|required_if:message_type,' . MessageTypeEnum::INDIVIDUAL_ATTENDEES->name,
            'attendee_ids.*' => 'integer',
            'product_ids' => ['array', 'required_if:message_type,' . MessageTypeEnum::TICKET_HOLDERS->name],
            'order_id' => 'integer|required_if:message_type,' . MessageTypeEnum::ORDER_OWNER->name,
            'product_ids.*' => 'integer',
            'order_statuses.*' => [
                'required_if:message_type,' . MessageTypeEnum::ORDER_OWNERS_WITH_PRODUCT->name,
                new In([OrderStatus::COMPLETED->name, OrderStatus::AWAITING_OFFLINE_PAYMENT->name]),
            ],
            'scheduled_at' => 'nullable|date',
            'attachments' => 'nullable|array|max:' . self::MAX_ATTACHMENTS,
            'attachments.*' => 'file|mimes:pdf|mimetypes:application/pdf|max:' . self::MAX_TOTAL_ATTACHMENT_SIZE_KB,
        ];
    }

    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $validator) {
            $totalSize = collect($this->file('attachments') ?? [])
                ->sum(fn(UploadedFile $file) => $file->getSize());

            if ($totalSize > self::MAX_TOTAL_ATTACHMENT_SIZE_KB * 1024) {
                $validator->errors()->add('attachments', __('Attachments must not exceed :size MB in total.', [
                    'size' => self::MAX_TOTAL_ATTACHMENT_SIZE_KB / 1024,
                ]));
            }
        });
    }

    public function messages(): array
    {
        return [
            'order_statuses.required_if' => 'The order statuses field is required when sending messages to order owners with a specific product.',
            'subject.max' => 'The subject must be less than 100 characters.',
            'attachments.max' => __('You can attach a maximum of :max files.', ['max' => self::MAX_ATTACHMENTS]),
            'attachments.*.mimes' => __('Attachments must be PDF files.'),
            'attachments.*.mimetypes' => __('Attachments must be PDF files.'),
            'attendee_ids.max' => 'You can only send a message to a maximum of 50 individual attendees at a time. ' .
                'To message more attendees, you can send to attendees with a specific product, or to all event attendees.'
        ];
    }
}
