<?php

namespace Tests\Unit\Services\Domain\Event\RouteFile;

use HiEvents\Exceptions\InvalidRouteFileException;
use HiEvents\Services\Domain\Event\RouteFile\GpxFileValidator;
use Illuminate\Http\UploadedFile;
use Tests\TestCase;

class GpxFileValidatorTest extends TestCase
{
    private const VALID_GPX = <<<'XML'
<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Garmin Connect" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata><name>Boucle du lac</name></metadata>
  <trk>
    <name>10 km</name>
    <trkseg>
      <trkpt lat="46.0457" lon="-74.2832"><ele>365.2</ele></trkpt>
      <trkpt lat="46.0461" lon="-74.2840"><ele>366.0</ele></trkpt>
    </trkseg>
  </trk>
</gpx>
XML;

    private GpxFileValidator $validator;

    protected function setUp(): void
    {
        parent::setUp();

        $this->validator = new GpxFileValidator();
    }

    public function test_a_gpx_file_is_accepted(): void
    {
        $this->validator->validate(UploadedFile::fake()->createWithContent('10 km.gpx', self::VALID_GPX));

        $this->addToAssertionCount(1);
    }

    public function test_a_gpx_without_namespace_and_with_a_utf8_bom_is_accepted(): void
    {
        $this->validator->validateContents("\xEF\xBB\xBF<gpx version=\"1.0\"><wpt lat=\"46.1\" lon=\"-74.2\"/></gpx>");

        $this->addToAssertionCount(1);
    }

    public function test_the_extension_is_checked_case_insensitively(): void
    {
        $this->validator->validate(UploadedFile::fake()->createWithContent('PARCOURS.GPX', self::VALID_GPX));

        $this->addToAssertionCount(1);
    }

    public function test_another_extension_is_refused(): void
    {
        $this->expectException(InvalidRouteFileException::class);

        $this->validator->validate(UploadedFile::fake()->createWithContent('route.xml', self::VALID_GPX));
    }

    public function test_a_file_that_is_not_xml_is_refused(): void
    {
        $this->expectException(InvalidRouteFileException::class);

        $this->validator->validate(UploadedFile::fake()->createWithContent('route.gpx', "lat,lon\n46.04,-74.28\n"));
    }

    public function test_an_empty_file_is_refused(): void
    {
        $this->expectException(InvalidRouteFileException::class);

        $this->validator->validateContents("  \n");
    }

    public function test_xml_that_is_not_well_formed_is_refused(): void
    {
        $this->expectException(InvalidRouteFileException::class);

        $this->validator->validateContents('<gpx version="1.1"><trk><name>10 km</trk></gpx>');
    }

    public function test_content_after_the_root_element_is_refused(): void
    {
        $this->expectException(InvalidRouteFileException::class);

        $this->validator->validateContents('<gpx version="1.1"></gpx><gpx version="1.1"></gpx>');
    }

    public function test_xml_with_another_root_element_is_refused(): void
    {
        $this->expectException(InvalidRouteFileException::class);

        $this->validator->validateContents('<?xml version="1.0"?><kml xmlns="http://www.opengis.net/kml/2.2"><Document/></kml>');
    }

    public function test_a_gpx_element_that_is_not_the_root_is_refused(): void
    {
        $this->expectException(InvalidRouteFileException::class);

        $this->validator->validateContents('<html><gpx version="1.1"/></html>');
    }

    public function test_an_external_entity_is_refused_and_never_read(): void
    {
        $secret = tempnam(sys_get_temp_dir(), 'gpx-secret');
        file_put_contents($secret, 'TOP-SECRET-MARKER');

        $payload = '<?xml version="1.0"?>'
            . '<!DOCTYPE gpx [<!ENTITY xxe SYSTEM "file://' . $secret . '">]>'
            . '<gpx version="1.1"><metadata><name>&xxe;</name></metadata></gpx>';

        try {
            $this->validator->validate(UploadedFile::fake()->createWithContent('route.gpx', $payload));
            $this->fail('An XXE payload was accepted');
        } catch (InvalidRouteFileException $exception) {
            $this->assertStringNotContainsString('TOP-SECRET-MARKER', $exception->getMessage());
        } finally {
            unlink($secret);
        }
    }

    public function test_a_network_entity_is_refused(): void
    {
        $this->expectException(InvalidRouteFileException::class);

        $this->validator->validateContents(
            '<?xml version="1.0"?><!DOCTYPE gpx SYSTEM "http://169.254.169.254/latest/meta-data/"><gpx version="1.1"/>'
        );
    }

    public function test_an_entity_expansion_bomb_is_refused(): void
    {
        $payload = '<?xml version="1.0"?><!DOCTYPE gpx ['
            . '<!ENTITY a "aaaaaaaaaa">'
            . '<!ENTITY b "&a;&a;&a;&a;&a;&a;&a;&a;&a;&a;">'
            . '<!ENTITY c "&b;&b;&b;&b;&b;&b;&b;&b;&b;&b;">'
            . ']><gpx version="1.1"><metadata><name>&c;</name></metadata></gpx>';

        $this->expectException(InvalidRouteFileException::class);

        $this->validator->validateContents($payload);
    }

    public function test_a_declaration_hidden_by_case_or_spacing_is_refused(): void
    {
        $this->expectException(InvalidRouteFileException::class);

        $this->validator->validateContents('<?xml version="1.0"?><! doctype gpx><gpx version="1.1"/>');
    }

    public function test_utf16_content_is_refused(): void
    {
        $this->expectException(InvalidRouteFileException::class);

        $this->validator->validateContents(mb_convert_encoding(
            '<?xml version="1.0" encoding="UTF-16"?><gpx version="1.1"/>',
            'UTF-16LE',
            'UTF-8',
        ));
    }

    public function test_a_file_over_10_mb_is_refused(): void
    {
        $this->expectException(InvalidRouteFileException::class);
        $this->expectExceptionMessage(__('The GPX file must be 10 MB or less.'));

        $this->validator->validate(UploadedFile::fake()->create('big.gpx', GpxFileValidator::MAX_KILOBYTES + 1));
    }

    public function test_a_long_track_just_under_10_mb_is_accepted(): void
    {
        $point = "<trkpt lat=\"46.0457\" lon=\"-74.2832\"><ele>365.2</ele><time>2026-06-12T08:00:00Z</time></trkpt>\n";
        $head = '<?xml version="1.0" encoding="UTF-8"?><gpx version="1.1" xmlns="http://www.topografix.com/GPX/1/1"><trk><trkseg>' . "\n";
        $tail = '</trkseg></trk></gpx>';
        $count = intdiv(GpxFileValidator::MAX_BYTES - strlen($head) - strlen($tail), strlen($point));
        $contents = $head . str_repeat($point, $count) . $tail;

        $this->assertGreaterThan(GpxFileValidator::MAX_BYTES - strlen($point), strlen($contents));

        $this->validator->validate(UploadedFile::fake()->createWithContent('long.gpx', $contents));
    }
}
