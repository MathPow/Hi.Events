<?php

namespace HiEvents\Resources\Organizer;

use HiEvents\DomainObjects\OrganizerMessageDomainObject;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin OrganizerMessageDomainObject
 */
class OrganizerMessageResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $event = $this->getEvent();

        return [
            'id' => $this->getId(),
            'organizer_id' => $this->getOrganizerId(),
            'event_id' => $this->getEventId(),
            'event' => $event ? [
                'id' => $event->getId(),
                'title' => $event->getTitle(),
                'slug' => $event->getSlug(),
            ] : null,
            'sender_name' => $this->getSenderName(),
            'sender_email' => $this->getSenderEmail(),
            'message' => $this->getMessage(),
            'read_at' => $this->getReadAt(),
            'replied_at' => $this->getRepliedAt(),
            'created_at' => $this->getCreatedAt(),
        ];
    }
}
