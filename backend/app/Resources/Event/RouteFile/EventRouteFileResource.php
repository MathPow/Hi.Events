<?php

namespace HiEvents\Resources\Event\RouteFile;

use HiEvents\DomainObjects\EventRouteFileDomainObject;
use HiEvents\Resources\BaseResource;
use Illuminate\Http\Request;

/**
 * @mixin EventRouteFileDomainObject
 */
class EventRouteFileResource extends BaseResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->getId(),
            'event_id' => $this->getEventId(),
            'label' => $this->getLabel(),
            'original_filename' => $this->getOriginalFilename(),
            'size' => $this->getSize(),
            'download_url' => $this->getDownloadUrl(),
            'created_at' => $this->getCreatedAt(),
        ];
    }
}
