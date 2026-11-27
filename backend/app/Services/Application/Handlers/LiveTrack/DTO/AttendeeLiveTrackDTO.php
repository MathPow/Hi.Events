<?php

namespace HiEvents\Services\Application\Handlers\LiveTrack\DTO;

use HiEvents\DataTransferObjects\BaseDataObject;
use HiEvents\DomainObjects\LiveTrackDomainObject;

class AttendeeLiveTrackDTO extends BaseDataObject
{
    public function __construct(
        public readonly bool                    $enabled,
        public readonly ?LiveTrackDomainObject $liveTrack,
    )
    {
    }
}
