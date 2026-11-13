<?php

namespace HiEvents\Services\Domain\Event\RouteFile;

use HiEvents\Exceptions\InvalidRouteFileException;
use Illuminate\Http\UploadedFile;
use XMLReader;

/**
 * Accepts a course only if it is a .gpx file of at most 10 MB whose XML is well formed with a <gpx>
 * root. The XML is read as a stream, without network access, DTD or entities: a document declaring
 * any (XXE, billion laughs) is refused before it is parsed.
 */
class GpxFileValidator
{
    public const MAX_KILOBYTES = 10240;

    public const MAX_BYTES = self::MAX_KILOBYTES * 1024;

    /**
     * @throws InvalidRouteFileException
     */
    public function validate(UploadedFile $file): void
    {
        if (strtolower($file->getClientOriginalExtension()) !== 'gpx') {
            throw new InvalidRouteFileException(__('Choose a GPX file.'));
        }

        $size = $file->getSize();
        if ($size === false || $size > self::MAX_BYTES) {
            throw new InvalidRouteFileException(__('The GPX file must be 10 MB or less.'));
        }

        $contents = @file_get_contents($file->getRealPath());
        if ($contents === false) {
            throw new InvalidRouteFileException(__('This file is not a valid GPX file.'));
        }

        $this->validateContents($contents);
    }

    /**
     * @throws InvalidRouteFileException
     */
    public function validateContents(string $contents): void
    {
        if (strlen($contents) > self::MAX_BYTES) {
            throw new InvalidRouteFileException(__('The GPX file must be 10 MB or less.'));
        }

        // A NUL byte means UTF-16/32 (or binary), where the declaration check below could not see.
        if (trim($contents) === ''
            || str_contains($contents, "\0")
            || preg_match('/<!\s*(DOCTYPE|ENTITY)/i', $contents) === 1) {
            throw new InvalidRouteFileException(__('This file is not a valid GPX file.'));
        }

        if (!$this->hasGpxRoot($contents)) {
            throw new InvalidRouteFileException(__('This file is not a valid GPX file.'));
        }
    }

    private function hasGpxRoot(string $contents): bool
    {
        $previous = libxml_use_internal_errors(true);
        $reader = new XMLReader();

        try {
            if (!$reader->XML($contents, null, LIBXML_NONET)) {
                return false;
            }
            $reader->setParserProperty(XMLReader::LOADDTD, false);
            $reader->setParserProperty(XMLReader::DEFAULTATTRS, false);
            $reader->setParserProperty(XMLReader::SUBST_ENTITIES, false);

            $root = null;
            while ($reader->read()) {
                if ($reader->nodeType === XMLReader::DOC_TYPE) {
                    return false;
                }
                if ($root === null && $reader->nodeType === XMLReader::ELEMENT) {
                    $root = $reader->localName;
                }
            }

            return $root === 'gpx' && libxml_get_errors() === [];
        } finally {
            $reader->close();
            libxml_clear_errors();
            libxml_use_internal_errors($previous);
        }
    }
}
