<?php

namespace Tests\Unit\Services\Domain\Message;

use HiEvents\Exceptions\CouldNotStoreMessageAttachmentException;
use HiEvents\Services\Domain\Message\MessageAttachmentService;
use Illuminate\Config\Repository;
use Illuminate\Contracts\Filesystem\Filesystem;
use Illuminate\Filesystem\FilesystemManager;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Mockery as m;
use Psr\Log\LoggerInterface;
use Tests\TestCase;

class MessageAttachmentServiceTest extends TestCase
{
    public function testStoresPdfsOnPrivateDiskAndReturnsMetadata(): void
    {
        Storage::fake('test-private');
        config(['filesystems.private' => 'test-private']);

        $service = new MessageAttachmentService(
            filesystemManager: app(FilesystemManager::class),
            config: app(Repository::class),
            logger: m::mock(LoggerInterface::class),
        );

        $result = $service->store(42, [
            UploadedFile::fake()->create('Plan du site (final).pdf', 100, 'application/pdf'),
        ]);

        $this->assertCount(1, $result);
        $this->assertSame('test-private', $result[0]['disk']);
        $this->assertSame('plan-du-site-final.pdf', $result[0]['name']);
        $this->assertStringStartsWith('message-attachments/42/', $result[0]['path']);
        Storage::disk('test-private')->assertExists($result[0]['path']);
    }

    public function testReturnsEmptyArrayWhenNoFiles(): void
    {
        $service = new MessageAttachmentService(
            filesystemManager: m::mock(FilesystemManager::class),
            config: app(Repository::class),
            logger: m::mock(LoggerInterface::class),
        );

        $this->assertSame([], $service->store(1, []));
    }

    public function testThrowsWhenStorageFails(): void
    {
        $disk = m::mock(Filesystem::class);
        $disk->shouldReceive('putFileAs')->andReturn(false);

        $filesystemManager = m::mock(FilesystemManager::class);
        $filesystemManager->shouldReceive('disk')->andReturn($disk);

        $logger = m::mock(LoggerInterface::class);
        $logger->shouldReceive('error')->once();

        $service = new MessageAttachmentService(
            filesystemManager: $filesystemManager,
            config: app(Repository::class),
            logger: $logger,
        );

        $this->expectException(CouldNotStoreMessageAttachmentException::class);

        $service->store(1, [UploadedFile::fake()->create('doc.pdf', 10, 'application/pdf')]);
    }

    public function testDeletesStoredAttachments(): void
    {
        Storage::fake('test-private');
        Storage::disk('test-private')->put('message-attachments/1/abc.pdf', 'pdf');

        $service = new MessageAttachmentService(
            filesystemManager: app(FilesystemManager::class),
            config: app(Repository::class),
            logger: m::mock(LoggerInterface::class),
        );

        $service->delete([
            ['disk' => 'test-private', 'path' => 'message-attachments/1/abc.pdf', 'name' => 'abc.pdf'],
        ]);

        Storage::disk('test-private')->assertMissing('message-attachments/1/abc.pdf');
    }
}
