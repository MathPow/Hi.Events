<?php

namespace HiEvents\DomainObjects\Enums;

/**
 * The questions of the participant form (AddParticipantFormHandler), each
 * created once per event.
 */
enum QuestionPresetKey: string
{
    use BaseEnum;

    case DATE_OF_BIRTH = 'date_of_birth';
    case EMERGENCY_CONTACT_NAME = 'emergency_contact_name';
    case EMERGENCY_CONTACT_PHONE = 'emergency_contact_phone';
    case HEALTH_NOTES = 'health_notes';
}
