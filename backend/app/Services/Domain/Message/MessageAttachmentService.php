<?php

declare(strict_types=1);

namespace HiEvents\Services\Domain\Message;

use HiEvents\Exceptions\CouldNotStoreMessageAttachmentException;
use Illuminate\Config\Repository;
use Illuminate\Filesystem\FilesystemManager;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Str;
use Psr\Log\LoggerInterface;

class MessageAttachmentService
{
    public function __construct(
        private readonly FilesystemManager $filesystemManager,
        private readonly Repository        $config,
        private readonly LoggerInterface   $logger,
    )
    {
    }

    /**
     * @param UploadedFile[] $files
     * @return array<int, array{disk: string, path: string, name: string}>
     * @throws CouldNotStoreMessageAttachmentException
     */
    public function store(int $eventId, array $files): array
    {
        $disk = $this->config->get('filesystems.private');

        return array_map(function (UploadedFile $file) use ($disk, $eventId) {
            $path = $this->filesystemManager->disk($disk)->putFileAs(
                path: 'message-attachments/' . $eventId,
                file: $file,
                name: Str::random(32) . '.pdf',
            );

            if ($path === false) {
                $this->logger->error('Could not store message attachment', [
                    'disk' => $disk,
                    'event_id' => $eventId,
                    'original_filename' => $file->getClientOriginalName(),
                ]);

                throw new CouldNotStoreMessageAttachmentException(__('Could not upload attachment'));
            }

            return [
                'disk' => $disk,
                'path' => $path,
                'name' => $this->sanitizeFilename($file->getClientOriginalName()),
            ];
        }, array_values($files));
    }

    /**
     * @param array<int, array{disk: string, path: string, name: string}> $attachments
     */
    public function delete(array $attachments): void
    {
        foreach ($attachments as $attachment) {
            $this->filesystemManager->disk($attachment['disk'])->delete($attachment['path']);
        }
    }

    private function sanitizeFilename(string $originalName): string
    {
        $basename = Str::slug(pathinfo($originalName, PATHINFO_FILENAME));

        return ($basename === '' ? 'attachment' : Str::limit($basename, 100, '')) . '.pdf';
    }
}
