<?php

namespace HiEvents\Resources\Event\RouteFile;

use HiEvents\DomainObjects\EventRouteFileDomainObject;
use HiEvents\Resources\BaseResource;
use Illuminate\Http\Request;

/**
 * @mixin EventRouteFileDomainObject
 */
class EventRouteFileResourcePublic extends BaseResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->getId(),
            'label' => $this->getLabel(),
            'size' => $this->getSize(),
            'download_url' => $this->getDownloadUrl(),
        ];
    }
}
