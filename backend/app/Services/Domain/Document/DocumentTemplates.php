<?php

namespace HiEvents\Services\Domain\Document;

use Illuminate\Support\Str;

/**
 * The starting documents Billetterie Dehors offers organizers. They are a
 * starting point, not legal advice: the page says so next to them.
 */
final class DocumentTemplates
{
    public const PARENTAL_CONSENT = 'parental_consent';
    public const LIABILITY_WAIVER = 'liability_waiver';
    public const MEDICAL_FORM = 'medical_form';
    public const PHOTO_CONSENT = 'photo_consent';
    public const BLANK = 'blank';

    public const KEYS = [
        self::PARENTAL_CONSENT,
        self::LIABILITY_WAIVER,
        self::MEDICAL_FORM,
        self::PHOTO_CONSENT,
        self::BLANK,
    ];

    /**
     * @return array{title: string, audience: string, blocks: array[]}
     */
    public static function make(string $key, string $locale): array
    {
        $french = str_starts_with(strtolower($locale), 'fr');

        return match ($key) {
            self::PARENTAL_CONSENT => $french ? self::parentalConsentFr() : self::parentalConsentEn(),
            self::LIABILITY_WAIVER => $french ? self::liabilityWaiverFr() : self::liabilityWaiverEn(),
            self::MEDICAL_FORM => $french ? self::medicalFormFr() : self::medicalFormEn(),
            self::PHOTO_CONSENT => $french ? self::photoConsentFr() : self::photoConsentEn(),
            default => $french ? self::blankFr() : self::blankEn(),
        };
    }

    private static function parentalConsentFr(): array
    {
        return [
            'title' => 'Attestation pour participant mineur',
            'audience' => 'MINORS',
            'blocks' => [
                self::title('Attestation parentale'),
                self::paragraph('Je, soussigné(e), parent ou tuteur légal de ', self::auto('participant_name'), ', né(e) le ', self::auto('date_of_birth'), ', autorise sa participation à ', self::auto('event_name'), ' le ', self::auto('event_date'), ', organisé par ', self::auto('organizer_name'), '.'),
                self::clause('Je reconnais que cette activité comporte des risques liés au plein air.'),
                self::clause('Je confirme que mon enfant est en bonne condition physique pour y participer.'),
                self::clause("J'autorise l'organisateur à faire appel aux services d'urgence au besoin."),
                self::field("Téléphone pour me joindre pendant l'activité", true),
                self::checkbox("J'accepte que des photos soient prises pendant l'activité."),
                self::signature(DocumentBlocks::SIGNER_GUARDIAN),
            ],
        ];
    }

    private static function parentalConsentEn(): array
    {
        return [
            'title' => 'Consent for a minor participant',
            'audience' => 'MINORS',
            'blocks' => [
                self::title('Parental consent'),
                self::paragraph('I, the undersigned, parent or legal guardian of ', self::auto('participant_name'), ', born on ', self::auto('date_of_birth'), ', allow them to take part in ', self::auto('event_name'), ' on ', self::auto('event_date'), ', organized by ', self::auto('organizer_name'), '.'),
                self::clause('I understand that this outdoor activity involves risks.'),
                self::clause('I confirm that my child is in good physical condition to take part.'),
                self::clause('I allow the organizer to call emergency services if needed.'),
                self::field('Phone number to reach me during the activity', true),
                self::checkbox('I agree that photos may be taken during the activity.'),
                self::signature(DocumentBlocks::SIGNER_GUARDIAN),
            ],
        ];
    }

    private static function liabilityWaiverFr(): array
    {
        return [
            'title' => 'Décharge de responsabilité',
            'audience' => 'ALL',
            'blocks' => [
                self::title('Décharge de responsabilité'),
                self::paragraph('Je, ', self::auto('participant_name'), ', participe à ', self::auto('event_name'), ' le ', self::auto('event_date'), ', organisé par ', self::auto('organizer_name'), '. En signant ce document, je reconnais ce qui suit :'),
                self::clause("Je participe à cette activité de mon plein gré et je comprends qu'elle comporte des risques, notamment des blessures, une météo changeante et un terrain accidenté."),
                self::clause("Je suis en bonne condition physique et je ne connais aucune raison médicale qui m'empêcherait d'y participer."),
                self::clause("Je m'engage à suivre les consignes de l'organisateur et des responsables sur place."),
                self::clause("J'accepte les risques liés à ma participation, dans la mesure permise par la loi."),
                self::clause("J'autorise l'organisateur à faire appel aux services d'urgence au besoin."),
                self::separator(),
                self::signature(DocumentBlocks::SIGNER_PARTICIPANT),
                self::signature(DocumentBlocks::SIGNER_GUARDIAN),
            ],
        ];
    }

    private static function liabilityWaiverEn(): array
    {
        return [
            'title' => 'Liability waiver',
            'audience' => 'ALL',
            'blocks' => [
                self::title('Liability waiver'),
                self::paragraph('I, ', self::auto('participant_name'), ', am taking part in ', self::auto('event_name'), ' on ', self::auto('event_date'), ', organized by ', self::auto('organizer_name'), '. By signing this document, I acknowledge the following:'),
                self::clause('I take part in this activity of my own free will and I understand that it involves risks, including injuries, changing weather and rough terrain.'),
                self::clause('I am in good physical condition and I know of no medical reason that would keep me from taking part.'),
                self::clause('I will follow the instructions of the organizer and of the people in charge on site.'),
                self::clause('I accept the risks of taking part, to the extent permitted by law.'),
                self::clause('I allow the organizer to call emergency services if needed.'),
                self::separator(),
                self::signature(DocumentBlocks::SIGNER_PARTICIPANT),
                self::signature(DocumentBlocks::SIGNER_GUARDIAN),
            ],
        ];
    }

    private static function medicalFormFr(): array
    {
        return [
            'title' => 'Formulaire médical',
            'audience' => 'ALL',
            'blocks' => [
                self::title('Formulaire médical'),
                self::paragraph("Ces renseignements servent seulement en cas d'urgence pendant ", self::auto('event_name'), '. Seul ', self::auto('organizer_name'), ' les reçoit.'),
                self::field("Personne à joindre en cas d'urgence", true),
                self::field('Téléphone de cette personne', true),
                self::field('Allergies (ou « aucune »)', true),
                self::field('Médicaments pris régulièrement (ou « aucun »)', true),
                self::field('Problèmes de santé à connaître (ou « aucun »)', true),
                self::checkbox("J'autorise l'organisateur à transmettre ces renseignements aux services d'urgence au besoin.", true),
                self::signature(DocumentBlocks::SIGNER_PARTICIPANT),
                self::signature(DocumentBlocks::SIGNER_GUARDIAN),
            ],
        ];
    }

    private static function medicalFormEn(): array
    {
        return [
            'title' => 'Medical form',
            'audience' => 'ALL',
            'blocks' => [
                self::title('Medical form'),
                self::paragraph('This information is only used in an emergency during ', self::auto('event_name'), '. Only ', self::auto('organizer_name'), ' receives it.'),
                self::field('Emergency contact', true),
                self::field("Emergency contact's phone number", true),
                self::field('Allergies (or "none")', true),
                self::field('Medication taken regularly (or "none")', true),
                self::field('Health conditions to know about (or "none")', true),
                self::checkbox('I allow the organizer to share this information with emergency services if needed.', true),
                self::signature(DocumentBlocks::SIGNER_PARTICIPANT),
                self::signature(DocumentBlocks::SIGNER_GUARDIAN),
            ],
        ];
    }

    private static function photoConsentFr(): array
    {
        return [
            'title' => 'Autorisation photo et vidéo',
            'audience' => 'ALL',
            'blocks' => [
                self::title('Autorisation photo et vidéo'),
                self::paragraph('Pendant ', self::auto('event_name'), ', ', self::auto('organizer_name'), ' pourrait prendre des photos et des vidéos des participants.'),
                self::paragraph("J'autorise ", self::auto('organizer_name'), " à utiliser, sans rémunération, les photos et vidéos où j'apparais :"),
                self::bulletList('sur son site web et ses réseaux sociaux;', 'dans ses infolettres et ses documents promotionnels.'),
                self::paragraph("Je peux retirer cette autorisation en tout temps en écrivant à l'organisateur. Ce qui est déjà publié peut rester en ligne."),
                self::checkbox("J'accepte d'apparaître sur les photos et les vidéos."),
                self::signature(DocumentBlocks::SIGNER_PARTICIPANT),
                self::signature(DocumentBlocks::SIGNER_GUARDIAN),
            ],
        ];
    }

    private static function photoConsentEn(): array
    {
        return [
            'title' => 'Photo and video consent',
            'audience' => 'ALL',
            'blocks' => [
                self::title('Photo and video consent'),
                self::paragraph('During ', self::auto('event_name'), ', ', self::auto('organizer_name'), ' may take photos and videos of the participants.'),
                self::paragraph('I allow ', self::auto('organizer_name'), ' to use, without payment, the photos and videos I appear in:'),
                self::bulletList('on its website and social media;', 'in its newsletters and promotional material.'),
                self::paragraph('I can withdraw this consent at any time by writing to the organizer. What is already published may stay online.'),
                self::checkbox('I agree to appear in photos and videos.'),
                self::signature(DocumentBlocks::SIGNER_PARTICIPANT),
                self::signature(DocumentBlocks::SIGNER_GUARDIAN),
            ],
        ];
    }

    private static function blankFr(): array
    {
        return [
            'title' => 'Document sans titre',
            'audience' => 'ALL',
            'blocks' => [
                self::title('Titre du document'),
                self::paragraph(),
                self::signature(DocumentBlocks::SIGNER_PARTICIPANT),
            ],
        ];
    }

    private static function blankEn(): array
    {
        return [
            'title' => 'Untitled document',
            'audience' => 'ALL',
            'blocks' => [
                self::title('Document title'),
                self::paragraph(),
                self::signature(DocumentBlocks::SIGNER_PARTICIPANT),
            ],
        ];
    }

    private static function id(): string
    {
        return 'b' . Str::lower(Str::random(10));
    }

    private static function auto(string $key): array
    {
        return ['type' => 'field', 'attrs' => ['key' => $key]];
    }

    /**
     * A paragraph from strings and automatic fields.
     */
    private static function inline(array|string ...$parts): array
    {
        $content = array_map(
            static fn(array|string $part) => is_string($part) ? ['type' => 'text', 'text' => $part] : $part,
            $parts,
        );

        return $content ? ['type' => 'paragraph', 'content' => $content] : ['type' => 'paragraph'];
    }

    private static function rich(array|string ...$parts): array
    {
        return ['type' => 'doc', 'content' => [self::inline(...$parts)]];
    }

    private static function title(string $text): array
    {
        return ['id' => self::id(), 'type' => DocumentBlocks::TITLE, 'content' => self::rich($text)];
    }

    private static function paragraph(array|string ...$parts): array
    {
        return ['id' => self::id(), 'type' => DocumentBlocks::PARAGRAPH, 'content' => self::rich(...$parts)];
    }

    private static function clause(string $text): array
    {
        return ['id' => self::id(), 'type' => DocumentBlocks::CLAUSE, 'content' => self::rich($text)];
    }

    private static function bulletList(string ...$items): array
    {
        return [
            'id' => self::id(),
            'type' => DocumentBlocks::LIST,
            'content' => ['type' => 'doc', 'content' => [[
                'type' => 'bulletList',
                'content' => array_map(
                    static fn(string $item) => ['type' => 'listItem', 'content' => [self::inline($item)]],
                    $items,
                ),
            ]]],
        ];
    }

    private static function field(string $label, bool $required = false): array
    {
        return ['id' => self::id(), 'type' => DocumentBlocks::FIELD, 'label' => $label, 'required' => $required];
    }

    private static function checkbox(string $text, bool $required = false): array
    {
        return ['id' => self::id(), 'type' => DocumentBlocks::CHECKBOX, 'content' => self::rich($text), 'required' => $required];
    }

    private static function signature(string $signer): array
    {
        return ['id' => self::id(), 'type' => DocumentBlocks::SIGNATURE, 'signer' => $signer];
    }

    private static function separator(): array
    {
        return ['id' => self::id(), 'type' => DocumentBlocks::SEPARATOR];
    }
}
