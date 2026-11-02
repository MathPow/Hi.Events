<?php

namespace HiEvents\Repository\DTO;

use HiEvents\DataTransferObjects\BaseDataObject;

/**
 * The latest arrival on a check-in list: who, and when (UTC).
 */
class LastCheckInDTO extends BaseDataObject
{
    public function __construct(
        public int    $checkInListId,
        public string $checkedInAt,
        public string $attendeeName,
    )
    {
    }
}
