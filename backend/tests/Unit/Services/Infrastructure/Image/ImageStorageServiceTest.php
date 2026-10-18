<?php

namespace Tests\Unit\Services\Infrastructure\Image;

use HiEvents\Services\Infrastructure\Image\Exception\CouldNotUploadImageException;
use HiEvents\Services\Infrastructure\Image\ImageStorageService;
use Illuminate\Config\Repository;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Psr\Log\NullLogger;
use Tests\TestCase;

class ImageStorageServiceTest extends TestCase
{
    private ImageStorageService $service;

    protected function setUp(): void
    {
        parent::setUp();

        Storage::fake('public');

        $this->service = new ImageStorageService(
            filesystemManager: app('filesystem'),
            config: new Repository(['filesystems' => ['public' => 'public']]),
            logger: new NullLogger(),
        );
    }

    public function testTheStoredExtensionComesFromTheContentNotTheUploadedName(): void
    {
        // Un vrai GIF suivi d'un script, nomme comme une page web.
        $gif = base64_decode('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7') . '<script>alert(1)</script>';
        $file = $this->upload('poc.html', $gif);

        $stored = $this->service->store($file, 'GENERIC');

        $this->assertStringEndsWith('.gif', $stored->filename);
        $this->assertStringStartsWith('poc-', $stored->filename);
        Storage::disk('public')->assertExists($stored->path);
    }

    public function testANormalImageKeepsItsName(): void
    {
        $png = base64_decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==');
        $file = $this->upload('Affiche du show.png', $png);

        $stored = $this->service->store($file, 'EVENT_COVER');

        $this->assertMatchesRegularExpression('/^affiche-du-show-[A-Za-z0-9]{5}\.png$/', $stored->filename);
        $this->assertStringStartsWith('event_cover/', $stored->path);
    }

    public function testAFileThatIsNotAnImageIsRefused(): void
    {
        $file = $this->upload('photo.png', '<html><script>alert(1)</script></html>');

        $this->expectException(CouldNotUploadImageException::class);

        $this->service->store($file, 'GENERIC');
    }

    /**
     * Un vrai fichier temporaire: le type est detecte depuis le contenu, comme
     * pour un vrai televersement, et non devine depuis le nom.
     */
    private function upload(string $clientName, string $content): UploadedFile
    {
        $path = tempnam(sys_get_temp_dir(), 'upload');
        file_put_contents($path, $content);

        return new UploadedFile($path, $clientName, null, null, true);
    }
}
