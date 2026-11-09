<?php

namespace HiEvents\Services\Application\Handlers\Organizer\Documents;

use HiEvents\DomainObjects\OrganizerDocumentDomainObject;
use HiEvents\Exceptions\DocumentImportException;
use HiEvents\Services\Domain\Document\Import\ImportedDocumentBuilder;
use HiEvents\Services\Domain\Document\Import\PdfDocumentReader;
use Illuminate\Validation\ValidationException;

/**
 * « Import a PDF » on the Documents page: the assistant reads the PDF and the
 * document is rebuilt, block by block, for the organizer to check in the editor.
 */
class ImportOrganizerDocumentPdfHandler
{
    public function __construct(
        private readonly PdfDocumentReader         $reader,
        private readonly ImportedDocumentBuilder   $builder,
        private readonly OrganizerDocumentHandler  $documentHandler,
    )
    {
    }

    /**
     * @param callable(int): void $progress
     * @throws DocumentImportException|ValidationException
     */
    public function handle(
        int      $organizerId,
        int      $accountId,
        ?int     $userId,
        string   $pdf,
        string   $fileName,
        callable $progress,
    ): OrganizerDocumentDomainObject
    {
        $read = $this->reader->read($pdf, $accountId, $userId, $progress);

        $fallbackTitle = trim(preg_replace('/[_-]+/u', ' ', pathinfo($fileName, PATHINFO_FILENAME)) ?? '');
        $imported = $this->builder->build($read, $fallbackTitle !== '' ? $fallbackTitle : __('Imported document'));

        if ($imported->blocks === []) {
            throw new DocumentImportException(__('No text could be read in this PDF. A scanned page may be too blurry: try a clearer copy.'));
        }

        return $this->documentHandler->createImported($organizerId, $imported);
    }
}
