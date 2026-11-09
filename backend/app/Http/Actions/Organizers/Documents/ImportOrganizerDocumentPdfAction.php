<?php

namespace HiEvents\Http\Actions\Organizers\Documents;

use HiEvents\DomainObjects\OrganizerDomainObject;
use HiEvents\Exceptions\DocumentImportException;
use HiEvents\Http\Actions\BaseAction;
use HiEvents\Http\ResponseCodes;
use HiEvents\Resources\Document\OrganizerDocumentResource;
use HiEvents\Services\Application\Handlers\Organizer\Documents\ImportOrganizerDocumentPdfHandler;
use HiEvents\Services\Domain\Assistant\AssistantQuotaService;
use HiEvents\Services\Domain\Document\Import\PdfDocumentReader;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;
use Psr\Log\LoggerInterface;
use Symfony\Component\HttpFoundation\StreamedResponse;
use Throwable;

/**
 * « Import a PDF »: the assistant rebuilds the organizer's PDF as a document.
 * Reading a PDF can take longer than Cloudflare waits for a first byte, so the
 * answer streams in NDJSON, a line per event:
 *   {type: progres, blocs: n}         as blocks are written (and every few seconds)
 *   {type: fin, document: {...}}      the new document
 *   {type: erreur, texte: "..."}
 */
class ImportOrganizerDocumentPdfAction extends BaseAction
{
    private const MAX_KILOBYTES = 10240;

    private const PROGRESS_SECONDS = 5;

    public function __construct(
        private readonly ImportOrganizerDocumentPdfHandler $handler,
        private readonly PdfDocumentReader                 $reader,
        private readonly AssistantQuotaService             $quotaService,
        private readonly LoggerInterface                   $logger,
    )
    {
    }

    /**
     * @throws ValidationException
     */
    public function __invoke(Request $request, int $organizerId): JsonResponse|StreamedResponse
    {
        $this->isActionAuthorized($organizerId, OrganizerDomainObject::class);

        $this->validate($request, [
            'file' => 'required|file|mimes:pdf|mimetypes:application/pdf|max:' . self::MAX_KILOBYTES,
        ], [
            'file.max' => __('The PDF must be 10 MB or less.'),
            'file.mimes' => __('Choose a PDF file.'),
            'file.mimetypes' => __('Choose a PDF file.'),
        ]);

        if (!$this->reader->isAvailable()) {
            return $this->errorResponse(__('The assistant is not available yet.'), ResponseCodes::HTTP_SERVICE_UNAVAILABLE);
        }

        $accountId = $this->getAuthenticatedAccountId();
        $userId = $this->getAuthenticatedUser()->getId();
        if (!$this->quotaService->consume($accountId)) {
            return $this->errorResponse(
                __('The assistant has reached its daily limit for this account. It will be back tomorrow.'),
                ResponseCodes::HTTP_TOO_MANY_REQUESTS,
            );
        }

        $file = $request->file('file');
        $pdf = (string)file_get_contents($file->getRealPath());
        $fileName = (string)$file->getClientOriginalName();

        return new StreamedResponse(function () use ($request, $organizerId, $accountId, $userId, $pdf, $fileName): void {
            @set_time_limit(300);
            while (ob_get_level() > 0) {
                ob_end_flush();
            }

            $write = static function (array $event): void {
                echo json_encode($event, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_INVALID_UTF8_SUBSTITUTE) . "\n";
                flush();
            };

            $lastBlocks = -1;
            $lastWrite = 0.0;
            $progress = static function (int $blocks) use ($write, &$lastBlocks, &$lastWrite): void {
                if ($blocks !== $lastBlocks || microtime(true) - $lastWrite > self::PROGRESS_SECONDS) {
                    $write(['type' => 'progres', 'blocs' => $blocks]);
                    $lastBlocks = $blocks;
                    $lastWrite = microtime(true);
                }
            };

            try {
                $document = $this->handler->handle($organizerId, $accountId, $userId, $pdf, $fileName, $progress);
                $write(['type' => 'fin', 'document' => (new OrganizerDocumentResource($document))->toArray($request)]);
            } catch (DocumentImportException $exception) {
                $write(['type' => 'erreur', 'texte' => $exception->getMessage()]);
            } catch (ValidationException $exception) {
                $write(['type' => 'erreur', 'texte' => collect($exception->errors())->flatten()->first() ?? __('The document could not be created. Please try again.')]);
            } catch (Throwable $exception) {
                $this->logger->error('Document import failed', ['exception' => $exception]);
                $write(['type' => 'erreur', 'texte' => __('The document could not be created. Please try again.')]);
            }
        }, ResponseCodes::HTTP_OK, [
            'Content-Type' => 'application/x-ndjson; charset=utf-8',
            'Cache-Control' => 'no-cache, no-transform',
            'X-Accel-Buffering' => 'no',
        ]);
    }
}
