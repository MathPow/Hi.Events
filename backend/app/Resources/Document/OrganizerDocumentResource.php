<?php

namespace HiEvents\Resources\Document;

use HiEvents\DomainObjects\OrganizerDocumentDomainObject;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin OrganizerDocumentDomainObject
 */
class OrganizerDocumentResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->getId(),
            'organizer_id' => $this->getOrganizerId(),
            'title' => $this->getTitle(),
            'blocks' => $this->getBlocks(),
            'signing_mode' => $this->getSigningMode(),
            'audience' => $this->getAudience(),
            'audience_age' => $this->getAudienceAge(),
            'template' => $this->getTemplate(),
            'event_ids' => $this->getEventIds(),
            'created_at' => $this->getCreatedAt(),
            'updated_at' => $this->getUpdatedAt(),
        ];
    }
}
